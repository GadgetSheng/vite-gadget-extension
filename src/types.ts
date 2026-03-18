export interface MockRule {
  id: string;
  urlPattern: string;
  method: string; // 'GET', 'POST', 'PUT', 'DELETE', 'ALL'
  status: number;
  responseBody: string;
  delayMs?: number;
  active: boolean;
}
