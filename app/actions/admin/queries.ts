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
  getExpensesData,
  getReportData,
  getRecipeData,
  getSettlementData,
  getIngredientStockData,
  getIngredientLogs,
  adjustIngredientStock,
  setLowStockAlert,
  getMenuPerformanceData,
  listJurnal,
  listPengeluaran,
  listCategories,
  listCatat,
  listCashAccounts,
  listMonths,
} from "./queries/index";

export type {
  TransactionDetail,
  ReportData,
  RecipeData,
  SettlementData,
  IngredientStockData,
  IngredientLog,
  MenuPerformanceData,
  MenuPerformanceRow,
  DateRange,
  JurnalRow,
} from "./queries/index";
