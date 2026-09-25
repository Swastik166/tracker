// Supabase browser configuration.
// Project URL + publishable key are intentionally safe for a public browser app.
// NEVER put a Supabase secret key / service_role key / database password here.
window.SUPABASE_CONFIG = {
  url: "https://vruvcmpvhzauqfaopxks.supabase.co",
  publishableKey: "sb_publishable_m_Wb48XD45nENsUUVMa7Qw_jfdqoRIA",

  // Keep true only while creating your first account from the site.
  showCreateAccount: true,

  // New learning/project items start public unless changed from the item row.
  defaultItemVisibility: "public",

  // Activity logging defaults to including date + minutes in the public heatmap.
  publicHeatmapByDefault: true
};
