export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  body: string;
  status: 'draft' | 'sending' | 'scheduled' | 'sent';
  scheduled_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  recipient_count?: number;
  recipients?: Recipient[];
  stats?: CampaignStats;
}

export interface Recipient {
  id: string;
  email: string;
  name: string;
  created_at: string;
  CampaignRecipient?: {
    status: 'pending' | 'sent' | 'failed';
    sent_at: string | null;
    opened_at: string | null;
  };
}

export interface CampaignStats {
  total: number;
  sent: number;
  failed: number;
  opened: number;
  open_rate: number;
  send_rate: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}
