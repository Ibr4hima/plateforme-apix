// Lexique de l'investissement — type du terme. Les termes sont stockés en base
// et éditables depuis l'admin (/admin/lexique), servis par l'API GET /lexique.

export type Terme = {
  id: number;
  terme: string;
  definition: string;
  ordre?: number;
  actif?: boolean;
};
