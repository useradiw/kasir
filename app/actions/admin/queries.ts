// Re-export all query functions from domain-specific files.
// Existing imports from "@/app/actions/admin/queries" continue to work unchanged.
// NOTE: "use server" is declared in each individual file, not here.
export {
  getDashboardData,
  getStaffWithEmails,
  getSessionsData,
  getInventoryData,
  getTransactionsData,
  getTransactionDetail,
  getCashRegisterData,
  getAttendanceData,
  getReportData,
  getSettlementData,
  getMenuPerformanceData,
  listJurnal,
  listPengeluaran,
  listCategories,
  listCatat,
  listCashAccounts,
  listMonths,
  listSalesChannelAccounts,
  getLaporanKeuangan,
  getBukuKas,
  getCekSaldo,
} from "./queries/index";

export type {
  TransactionDetail,
  ReportData,
  SettlementData,
  MenuPerformanceData,
  MenuPerformanceRow,
  DateRange,
  JurnalRow,
  LaporanKeuangan,
  BukuKasAccount,
  BukuKasMovement,
  CekSaldoRow,
} from "./queries/index";
