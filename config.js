// Supabase browser configuration.
// Project URL + publishable key are intentionally safe for a public browser app.
// NEVER put a Supabase secret key / service_role key / database password here.
window.SUPABASE_CONFIG = {
  url: "https://aoqshajbrisrrlztenwa.supabase.co",
  publishableKey: "sb_publishable_URp8Yk0Z_9Y3DfSKsw-qbg_fnpDCCco",

  // Keep true only while creating your first account from the site.
  showCreateAccount: true,

  // New learning/project items start public unless changed from the item row.
  defaultItemVisibility: "public",

  // Activity logging defaults to including date + minutes in the public heatmap.
  publicHeatmapByDefault: true
};
