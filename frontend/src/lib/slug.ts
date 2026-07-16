// Slug d'URL d'un nom de pays : « Côte d'Ivoire » → « cote-d-ivoire »
export const slugPays = (nom: string) => (nom || "").toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
