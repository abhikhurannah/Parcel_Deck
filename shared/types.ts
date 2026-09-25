export type Role = 'operator' | 'insurer' | 'admin';
export type Status = 'routed' | 'pending_insurance' | 'rejected';
export interface ParcelInput {
  reference: string;
  weight: string;
  value: string;
  country: string;
  attributes: Record<string, string | boolean>;
}
export type Condition =
  | { field: 'weight' | 'value'; op: 'lt' | 'lte' | 'gt' | 'gte'; value: string }
  | { field: 'country'; op: 'in'; value: string[] }
  | { field: `attributes.${string}`; op: 'eq'; value: string | boolean };
export interface Rule {
  id: string;
  priority: number;
  when: Condition[];
  department: string;
}
export interface PolicyTest {
  name: string;
  parcel: ParcelInput;
  department: string;
  status: Exclude<Status, 'rejected'>;
}
export interface Policy {
  rules?: Rule[];
  tests?: PolicyTest[];
  insurance_threshold: string;
  bands: { max_kg: string | null; department: string }[];
  country_overrides: { country: string; department: string }[];
}
export interface Decision {
  department: string;
  status: Exclude<Status, 'rejected'>;
  reason: string;
}
export interface ParcelRecord extends Omit<ParcelInput, 'attributes'> {
  attributes: string;
  batch_id: number | null;
  id: number;
  department: string;
  status: Status;
  reason: string;
  policy_version: number;
  created_at: string;
}
export interface User {
  username: string;
  role: Role;
  csrf: string;
}
export interface BatchResult {
  batch_id?: number;
  departments?: Record<string, number>;
  errors?: RowError[];
  count: number;
  counts: { routed: number; pending_insurance: number };
  first_id: number;
  last_id: number;
  policy_version: number;
  replayed?: boolean;
}
export interface ParcelPage {
  items: ParcelRecord[];
  total: number;
  page: number;
  page_size: number;
}
export interface AuditRecord {
  id: number;
  actor: string;
  action: string;
  detail: string;
  request_id: string;
  created_at: string;
}
export interface PolicyVersion {
  version: number;
  body: string;
  actor: string;
  reason: string;
  created_at: string;
}
export interface PolicyResponse {
  version: number;
  policy: Policy;
  history: PolicyVersion[];
}
export interface Preview {
  sample_limit?: number;
  population?: number;
  tests?: { name: string; passed: boolean; actual: Decision }[];
  base_version: number;
  total: number;
  changed: number;
  new_holds: number;
  examples: { id: number; before: Decision; after: Decision }[];
  token: string;
  policy: Policy;
}
export interface Overview {
  counts: Partial<Record<Status, number>>;
  total: number;
  departments: { department: string; count: number; active: boolean }[];
  policy_version: number;
  signals: string[];
  alerts: { id: number; kind: string; detail: string; created_at: string }[];
}
export interface RowError {
  row: number;
  message: string;
}

export interface BatchRecord {
  id: number;
  filename: string;
  uploader: string;
  created_at: string;
  total: number;
  accepted: number;
  rejected: number;
  counts: string;
  errors: string;
  policy_version: number;
}
export interface ImportPreview {
  digest: string;
  policy_version: number;
  valid: number;
  invalid: number;
  counts: { routed: number; pending_insurance: number };
  departments: Record<string, number>;
  errors: RowError[];
  token: string;
}
