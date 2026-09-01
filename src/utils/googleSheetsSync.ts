import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { StorageData, calculatePeriodReport } from './storage';

const SPREADSHEET_ID_KEY = 'hershe_pos_google_spreadsheet_id';

let cachedAccessToken: string | null = null;

/**
 * Perform Google Auth Sign-in to get access token for Google Sheets API
 */
export async function authenticateGoogleSheets(): Promise<string> {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }

  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/spreadsheets');
  provider.addScope('https://www.googleapis.com/auth/drive.file');

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);

  if (!credential?.accessToken) {
    throw new Error('Failed to retrieve Google Access Token from authentication result.');
  }

  cachedAccessToken = credential.accessToken;
  return cachedAccessToken;
}

export function getSavedSpreadsheetId(): string | null {
  return localStorage.getItem(SPREADSHEET_ID_KEY);
}

export function saveSpreadsheetId(id: string): void {
  localStorage.setItem(SPREADSHEET_ID_KEY, id);
}

export function clearSavedSpreadsheetId(): void {
  localStorage.removeItem(SPREADSHEET_ID_KEY);
}

/**
 * Creates a brand new Google Spreadsheet titled "Hershe POS - Store Data Sync"
 */
async function createNewSpreadsheet(token: string): Promise<string> {
  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: 'Hershe POS - Store Data Sync',
      },
      sheets: [
        { properties: { title: 'Sales & Orders' } },
        { properties: { title: 'Expenses' } },
        { properties: { title: 'Shift Logs' } },
        { properties: { title: 'Monthly Balances' } },
        { properties: { title: 'Partnership Distribution' } },
        { properties: { title: 'Summary' } },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to create Google Spreadsheet');
  }

  const data = await response.json();
  const spreadsheetId = data.spreadsheetId;
  saveSpreadsheetId(spreadsheetId);
  return spreadsheetId;
}

/**
 * Ensures all required sheet tabs exist on an existing spreadsheet
 */
async function ensureSheetTabsExist(spreadsheetId: string, token: string): Promise<void> {
  try {
    const getRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!getRes.ok) return;

    const sheetInfo = await getRes.json();
    const existingTitles: string[] = (sheetInfo.sheets || []).map((s: any) => s.properties?.title || '');

    const requiredTabs = ['Sales & Orders', 'Expenses', 'Shift Logs', 'Monthly Balances', 'Partnership Distribution', 'Summary'];
    const missingTabs = requiredTabs.filter(t => !existingTitles.includes(t));

    if (missingTabs.length > 0) {
      const requests = missingTabs.map(title => ({
        addSheet: {
          properties: { title }
        }
      }));

      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requests })
      });
    }
  } catch (err) {
    console.warn('Note: Error checking or adding missing sheet tabs:', err);
  }
}

/**
 * Syncs / Exports orders, expenses, shift logs, monthly balances, and summary to Google Sheets
 */
export async function pushDataToGoogleSheets(
  data: StorageData,
  existingSpreadsheetId?: string
): Promise<{ spreadsheetId: string; url: string }> {
  const token = await authenticateGoogleSheets();

  let spreadsheetId = existingSpreadsheetId || getSavedSpreadsheetId();

  if (!spreadsheetId) {
    spreadsheetId = await createNewSpreadsheet(token);
  } else {
    // Check and create missing sheet tabs (e.g., Monthly Balances) if upgrading existing spreadsheet
    await ensureSheetTabsExist(spreadsheetId, token);
  }

  // Format Orders rows (including Staff On Shift)
  const orderHeaders = [
    'Order ID',
    'Date',
    'Time',
    'Staff On Shift',
    'Payment Method',
    'Subtotal ($)',
    'Discount ($)',
    'Total Amount ($)',
    'Items Summary',
  ];

  const orderRows = (data.orders || []).map((o) => {
    let staffName = o.staffName || '';
    if (!staffName) {
      const shiftMatch = (data.shifts || []).find(
        s => (s.checkInDate === o.date || s.status === 'active') && s.staffName
      );
      staffName = shiftMatch?.staffName || data.currentUser?.name || 'On-Shift Staff';
    }

    return [
      o.orderId || '',
      o.date || '',
      o.time || '',
      staffName,
      o.paymentType || '',
      o.subtotal || 0,
      o.discountValue || 0,
      o.totalAmount || 0,
      o.itemsSummary || (o.items || []).map((i) => `${i.qty}x ${i.name}`).join(', '),
    ];
  });

  // Format Expenses rows
  const expenseHeaders = ['Expense ID', 'Date', 'Description', 'Payment Method', 'Amount ($)'];
  const expenseRows = (data.expenses || []).map((e) => [
    e.id || '',
    e.date || '',
    e.description || '',
    e.paymentType || '',
    e.amount || 0,
  ]);

  // Format Shift Logs rows
  const shiftHeaders = [
    'Shift ID',
    'Staff Name',
    'Role',
    'Check-in Date',
    'Check-in Time',
    'Check-out Time',
    'Status',
  ];
  const shiftRows = (data.shifts || []).map((s) => [
    s.id || '',
    s.staffName || '',
    s.role || '',
    s.checkInDate || '',
    s.checkInTime || '',
    s.checkOutTime || '-',
    s.status || '',
  ]);

  // Calculate Monthly Account Balances (Historical breakdown by month)
  const allMonthsSet = new Set<string>();

  (data.orders || []).forEach(o => {
    if (o.date && o.date.length >= 7) {
      allMonthsSet.add(o.date.substring(0, 7));
    }
  });

  (data.expenses || []).forEach(e => {
    if (e.date && e.date.length >= 7) {
      allMonthsSet.add(e.date.substring(0, 7));
    }
  });

  if (allMonthsSet.size === 0) {
    const nowStr = new Date().toISOString().substring(0, 7);
    allMonthsSet.add(nowStr);
  }

  const sortedMonths = Array.from(allMonthsSet).sort();

  const monthlyBalanceHeaders = [
    'Month',
    'Cash Sales ($)',
    'Cash Expenses ($)',
    'Cash Net ($)',
    'Card Lulu Sales ($)',
    'Card Lulu Expenses ($)',
    'Card Lulu Net ($)',
    'Card Mizah Sales ($)',
    'Card Mizah Expenses ($)',
    'Card Mizah Net ($)',
    'Total Monthly Sales ($)',
    'Total Monthly Expenses ($)',
    'Monthly Net Balance ($)',
  ];

  let totCashIn = 0, totCashOut = 0;
  let totLuluIn = 0, totLuluOut = 0;
  let totMizahIn = 0, totMizahOut = 0;

  const monthlyBalanceRows: (string | number)[][] = sortedMonths.map(month => {
    const mOrders = (data.orders || []).filter(o => o.date && o.date.startsWith(month));
    const mExpenses = (data.expenses || []).filter(e => e.date && e.date.startsWith(month));

    let cashIn = 0, luluIn = 0, mizahIn = 0;
    mOrders.forEach(o => {
      const amt = o.totalAmount || 0;
      if (o.paymentType === 'Cash') cashIn += amt;
      else if (o.paymentType === 'Card Lulu') luluIn += amt;
      else if (o.paymentType === 'Card Mizah') mizahIn += amt;
    });

    let cashOut = 0, luluOut = 0, mizahOut = 0;
    mExpenses.forEach(e => {
      const amt = e.amount || 0;
      if (e.paymentType === 'Cash') cashOut += amt;
      else if (e.paymentType === 'Card Lulu') luluOut += amt;
      else if (e.paymentType === 'Card Mizah') mizahOut += amt;
    });

    const cashNet = cashIn - cashOut;
    const luluNet = luluIn - luluOut;
    const mizahNet = mizahIn - mizahOut;

    const totalSales = cashIn + luluIn + mizahIn;
    const totalExpenses = cashOut + luluOut + mizahOut;
    const monthlyNet = totalSales - totalExpenses;

    totCashIn += cashIn; totCashOut += cashOut;
    totLuluIn += luluIn; totLuluOut += luluOut;
    totMizahIn += mizahIn; totMizahOut += mizahOut;

    return [
      month,
      cashIn.toFixed(2),
      cashOut.toFixed(2),
      cashNet.toFixed(2),
      luluIn.toFixed(2),
      luluOut.toFixed(2),
      luluNet.toFixed(2),
      mizahIn.toFixed(2),
      mizahOut.toFixed(2),
      mizahNet.toFixed(2),
      totalSales.toFixed(2),
      totalExpenses.toFixed(2),
      monthlyNet.toFixed(2),
    ];
  });

  const grandTotalSales = totCashIn + totLuluIn + totMizahIn;
  const grandTotalExpenses = totCashOut + totLuluOut + totMizahOut;
  const grandTotalNet = grandTotalSales - grandTotalExpenses;

  monthlyBalanceRows.push([
    'ALL-TIME TOTAL',
    totCashIn.toFixed(2),
    totCashOut.toFixed(2),
    (totCashIn - totCashOut).toFixed(2),
    totLuluIn.toFixed(2),
    totLuluOut.toFixed(2),
    (totLuluIn - totLuluOut).toFixed(2),
    totMizahIn.toFixed(2),
    totMizahOut.toFixed(2),
    (totMizahIn - totMizahOut).toFixed(2),
    grandTotalSales.toFixed(2),
    grandTotalExpenses.toFixed(2),
    grandTotalNet.toFixed(2),
  ]);

  // Calculate Partnership Distribution Rows for current / recorded months
  const distributionConfigs = data.distributions || {};
  const activeMonths = Object.keys(distributionConfigs).length > 0
    ? Object.keys(distributionConfigs).sort().reverse()
    : ['2026-08'];

  const partnershipSheetValues: any[][] = [];

  activeMonths.forEach((mStr, idx) => {
    const cfg = distributionConfigs[mStr] || {
      month: mStr,
      juices: 17.50,
      juiceCount: 5,
      rental: 30.00,
      bottles: 105.00,
      customAccountNet: null,
      cashCarriedForward: 0.00,
      partners: [
        { id: 'p-mizah', name: 'Mizah', percentage: 45 },
        { id: 'p-ema', name: 'Ema', percentage: 0 },
        { id: 'p-lulu', name: 'Lulu', percentage: 45 },
        { id: 'p-rifah', name: 'Rifah', percentage: 10 },
      ],
    };

    const periodRep = calculatePeriodReport(data.orders || [], data.expenses || [], mStr, true);
    const combinedNet = cfg.customAccountNet !== null && cfg.customAccountNet !== undefined
      ? cfg.customAccountNet
      : periodRep.netProfit;

    const datTotal = (cfg.rental || 0) + (cfg.bottles || 0) - (cfg.juices || 0);
    const bal = combinedNet - datTotal;
    const baseDist = bal - (cfg.cashCarriedForward || 0);

    const partnerDist = (cfg.partners || []).map(p => {
      const amt = baseDist > 0 ? (baseDist * ((p.percentage || 0) / 100)) : 0;
      return {
        name: p.name,
        percentage: `${p.percentage.toFixed(2)}%`,
        amount: amt.toFixed(2),
      };
    });

    const totDist = partnerDist.reduce((acc, p) => acc + parseFloat(p.amount), 0);
    const leftoverAmt = Math.max(0, baseDist - totDist);

    if (idx > 0) partnershipSheetValues.push([]); // blank separator line

    partnershipSheetValues.push(
      ["Datul's / Distribution", "Value", "Amount (BND)"],
      [mStr, "", ""],
      ["Juices", `$3.50 × ${cfg.juiceCount || (cfg.juices ? Math.round(cfg.juices / 3.5) : 5)}`, cfg.juices.toFixed(2)],
      ["Rental", `$${cfg.rental.toFixed(2)}`, cfg.rental.toFixed(2)],
      ["Bottles", `$${cfg.bottles.toFixed(2)}`, cfg.bottles.toFixed(2)],
      ["Datul's Total", "", datTotal.toFixed(2)],
      [`Account Combined Net (${mStr})`, "", combinedNet.toFixed(2)],
      ["Balance", "", bal.toFixed(2)],
      ["Cash Carried Forward", "", (cfg.cashCarriedForward || 0).toFixed(2)],
      ["Base for Distribution", "", baseDist.toFixed(2)],
      [],
      ["Distribution", "Percentage", "Amount (BND)"],
      ...partnerDist.map(p => [p.name, p.percentage, p.amount]),
      ["Total Distributed", "", totDist.toFixed(2)],
      ["Leftover (Base - Distributed)", "", leftoverAmt.toFixed(2)]
    );
  });

  // Calculate Summary metrics
  const totalSalesRevenue = (data.orders || []).reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
  const totalExpensesAmount = (data.expenses || []).reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const netProfit = totalSalesRevenue - totalExpensesAmount;

  const summaryHeaders = ['Metric', 'Value'];
  const summaryRows = [
    ['Total Completed Sales', (data.orders || []).length],
    ['Total Gross Sales (BND)', totalSalesRevenue.toFixed(2)],
    ['Total Expenses (BND)', totalExpensesAmount.toFixed(2)],
    ['Net Profit (BND)', netProfit.toFixed(2)],
    ['Total Months Recorded', sortedMonths.length],
    ['Pending Approvals Count', (data.pendingOrders || []).length],
    ['Total Staff Shifts Recorded', (data.shifts || []).length],
    ['Last Export Timestamp', new Date().toLocaleString()],
  ];

  const payload = {
    valueInputOption: 'USER_ENTERED',
    data: [
      {
        range: "'Sales & Orders'!A1",
        majorDimension: 'ROWS',
        values: [orderHeaders, ...orderRows],
      },
      {
        range: "'Expenses'!A1",
        majorDimension: 'ROWS',
        values: [expenseHeaders, ...expenseRows],
      },
      {
        range: "'Shift Logs'!A1",
        majorDimension: 'ROWS',
        values: [shiftHeaders, ...shiftRows],
      },
      {
        range: "'Monthly Balances'!A1",
        majorDimension: 'ROWS',
        values: [monthlyBalanceHeaders, ...monthlyBalanceRows],
      },
      {
        range: "'Partnership Distribution'!A1",
        majorDimension: 'ROWS',
        values: partnershipSheetValues,
      },
      {
        range: "'Summary'!A1",
        majorDimension: 'ROWS',
        values: [summaryHeaders, ...summaryRows],
      },
    ],
  };

  const updateResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!updateResponse.ok) {
    const errData = await updateResponse.json();
    throw new Error(errData.error?.message || 'Failed to update Google Sheet values.');
  }

  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
  return { spreadsheetId, url };
}
