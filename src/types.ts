export type OrganizationRecord = {
  id: string;
  name: string;
  created_at: string;
};

export type ProjectRecord = {
  id: string;
  organization_id: string;
  name: string;
  created_at: string;
};

export type SessionRecord = {
  id: string;
  organization_id: string;
  project_id: string;
  title: string;
  archived: boolean;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

export type TranscriptItem = {
  id?: string | null;
  role: 'system' | 'user' | 'assistant' | 'tool' | 'tool_result' | 'log';
  text: string;
  tool_name?: string | null;
  tool_input?: Record<string, unknown> | null;
  is_error?: boolean | null;
};

export type TaskSnapshot = {
  id: string;
  type: string;
  status: string;
  description: string;
  metadata: Record<string, string>;
};

export type WebBackendEvent = {
  type: string;
  event_id: string;
  tenant_id: string;
  project_id: string;
  session_id: string;
  created_at: string;
  request_id?: string | null;
  message?: string | null;
  item?: TranscriptItem | null;
  state?: Record<string, unknown> | null;
  tasks?: TaskSnapshot[] | null;
  mcp_servers?: Array<Record<string, unknown>> | null;
  bridge_sessions?: Array<Record<string, unknown>> | null;
  commands?: string[] | null;
  modal?: Record<string, unknown> | null;
  select_options?: SelectOptionPayload[] | null;
  tool_name?: string | null;
  tool_input?: Record<string, unknown> | null;
  output?: string | null;
  is_error?: boolean | null;
  todo_markdown?: string | null;
};

export type WebFrontendRequest =
  | {type: 'submit_line'; request_id: string; line: string; attachments?: UploadedAttachment[]}
  | {type: 'permission_response'; request_id: string; allowed: boolean}
  | {type: 'question_response'; request_id: string; answer: string}
  | {type: 'select_command'; request_id: string; command: string}
  | {type: 'apply_select_command'; request_id: string; command: string; value: string}
  | {type: 'stop'; request_id: string}
  | {type: 'shutdown'; request_id: string};

export type SelectOptionPayload = {
  value: string;
  label: string;
  description?: string;
  active?: boolean;
  disabled?: boolean;
  badge?: string;
};

export type UploadedAttachment = {
  id: string;
  name: string;
  mime_type: string;
  size: number;
  path: string;
  is_image: boolean;
  preview_url?: string | null;
};

export type SessionDetail = {
  session: SessionRecord;
  messages: Array<{id: string; role: string; text: string; created_at: string}>;
  tool_events: ToolFeedback[];
};

export type ToolFeedback = {
  id: string;
  phase: 'started' | 'completed';
  tool_name: string;
  tool_input?: Record<string, unknown> | null;
  output?: string | null;
  is_error?: boolean | null;
  created_at: string;
};
