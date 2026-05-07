import {FormEvent, KeyboardEvent, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import ReactMarkdown from 'react-markdown';
import {Navigate, Route, Routes, useNavigate, useParams} from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import {
  ArrowUp,
  Bot,
  ChevronDown,
  Check,
  CircleStop,
  Edit3,
  FileText,
  Globe2,
  Image as ImageIcon,
  KeyRound,
  Mic,
  MessageSquarePlus,
  MoreHorizontal,
  Paperclip,
  Pencil,
  PanelLeft,
  PanelRightOpen,
  Pin,
  PinOff,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import {
  authSession,
  createSession,
  deleteSession,
  getSession,
  listOrganizations,
  listProjects,
  listSessions,
  newRequestId,
  runtimeStatus,
  uploadSessionAttachments,
  updateSession,
} from './api';
import {useWebSession} from './hooks/useWebSession';
import type {
  Components,
} from 'react-markdown';
import type {
  OrganizationRecord,
  SelectOptionPayload,
  SessionRecord,
  ToolFeedback,
  TranscriptItem,
  UploadedAttachment,
} from './types';

const UI = {
  newChat: '开启新对话',
  collapseSidebar: '收起边栏',
  expandSidebar: '打开边栏',
  more: '更多',
  rename: '重命名',
  pin: '置顶',
  unpin: '取消置顶',
  delete: '删除',
  deleteTitle: '删除对话？',
  deleteBodyPrefix: '此操作会从侧边栏移除该对话：',
  cancel: '取消',
  confirmDelete: '删除',
  greetings: ['今天在想些什么？', '有什么需要帮助的吗？', '我们先从哪里开始呢？'],
  composerPlaceholder: '有问题，尽管问',
  chooseModel: '选择模型',
  addFiles: '添加文件等',
  addPhotosAndFiles: '添加照片和文件',
  createImage: '创建图片',
  writeEdit: '撰写或编辑',
  config: '配置...',
  model: '模型',
  thinkingDuration: '思考时长',
  latest: '最新',
  instantDesc: '适用于日常聊天',
  thinkingDesc: '适用于解答复杂问题',
  proDesc: '适用于更深度的研究和推理',
  thinkingPillLabel: '思考',
  proPillLabel: 'Pro',
  autoThinking: '自动切换至 Thinking',
  autoThinkingDesc: '当你提出复杂问题时，ChatGPT 可以自动从“Instant”切换至“Thinking”。',
  voiceOnly: '语音输入（暂未启用）',
  connecting: '正在连接运行时...',
  search: '智能搜索',
  stop: '停止',
  send: '发送',
  footerDisclaimer: 'OpenHarness 也可能会犯错。请核查重要信息。',
  toolDone: '已完成',
  toolFailed: '调用失败',
  toolRunningTitle: '工具调用中',
  toolDoneTitle: '工具调用完成',
  toolFailedTitle: '工具调用失败',
  input: '输入',
  output: '输出',
  waitingTool: '等待工具返回...',
  close: '关闭',
};

type PendingPrompt = {sessionId: string; line: string; attachments?: UploadedAttachment[]; modelChoice?: string | null} | null;
type MenuState = {session: SessionRecord; top: number; left: number} | null;
type EffortMode = 'instant' | 'thinking' | 'pro';
type PendingAttachment = {
  id: string;
  name: string;
  mime_type: string;
  size: number;
  is_image: boolean;
  preview_url?: string | null;
  file: File;
};

const markdownComponents: Components = {
  a({node: _node, href, children, ...props}) {
    return (
      <a href={href} target="_blank" rel="noreferrer" {...props}>
        {children}
      </a>
    );
  },
};

export function App() {
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authSession()
      .then((session) => {
        if (cancelled) {
          return;
        }
        if (!session.authenticated) {
          window.location.href = session.login_url ?? '/api/auth/login';
          return;
        }
        setAuthReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          window.location.href = '/api/auth/login';
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!authReady) {
    return (
      <main className="login-shell">
        <section className="login-panel">
          <div className="mark"><Bot size={26} /></div>
          <h1>OpenHarness</h1>
          <p>Connecting to your workspace.</p>
        </section>
      </main>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/settings" element={<SettingsPage title="Settings" />} />
      <Route path="/settings/billing" element={<SettingsPage title="Billing" />} />
      <Route path="/settings/usage" element={<SettingsPage title="Usage" />} />
      <Route path="/org/:orgId" element={<WorkspacePage />} />
      <Route path="/org/:orgId/project/:projectId" element={<WorkspacePage />} />
      <Route path="/org/:orgId/project/:projectId/session/:sessionId" element={<WorkspacePage />} />
      <Route path="*" element={<Navigate to="/org/org_demo/project/proj_demo/session/sess_demo" replace />} />
    </Routes>
  );
}

function LoginPage() {
  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="mark"><Bot size={26} /></div>
        <h1>OpenHarness</h1>
        <p>Sign in to your organization workspace.</p>
        <button onClick={() => { window.location.href = '/api/auth/login'; }}>Sign in</button>
      </section>
    </main>
  );
}

function SettingsPage({title}: {title: string}) {
  return (
    <main className="settings-page">
      <h1>{title}</h1>
      <p>Organization controls, billing, usage, and provider budget settings are exposed here for the SaaS shell.</p>
    </main>
  );
}

function WorkspacePage() {
  const params = useParams();
  const navigate = useNavigate();
  const orgId = params.orgId ?? 'org_demo';
  const projectId = params.projectId ?? 'proj_demo';
  const sessionId = params.sessionId;
  const [orgs, setOrgs] = useState<OrganizationRecord[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [initialMessages, setInitialMessages] = useState<TranscriptItem[]>([]);
  const [initialToolEvents, setInitialToolEvents] = useState<ToolFeedback[]>([]);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [runtime, setRuntime] = useState<Record<string, unknown>>({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedTool, setSelectedTool] = useState<ToolFeedback | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SessionRecord | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<PendingPrompt>(null);
  const [modelChoice, setModelChoice] = useState<string | null>(null);
  const [greeting] = useState(() => UI.greetings[Math.floor(Math.random() * UI.greetings.length)]);

  const webSession = useWebSession(sessionId);

  useEffect(() => {
    void refreshWorkspace(orgId, projectId, sessionId);
  }, [orgId, projectId, sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setInitialMessages([]);
      setInitialToolEvents([]);
      setSessionLoaded(true);
      return;
    }
    setSessionLoaded(false);
    getSession(sessionId)
      .then((detail) => {
        setInitialMessages(detail.messages.map((message) => ({id: message.id, role: message.role as TranscriptItem['role'], text: message.text})));
        setInitialToolEvents(detail.tool_events ?? []);
      })
      .catch(() => {
        setInitialMessages([]);
        setInitialToolEvents([]);
      })
      .finally(() => {
        setSessionLoaded(true);
      });
  }, [sessionId]);

  useEffect(() => {
    if (!pendingPrompt || pendingPrompt.sessionId !== sessionId || !webSession.connected || webSession.busy) {
      return;
    }
    if (pendingPrompt.modelChoice) {
      webSession.send({type: 'apply_select_command', request_id: newRequestId(), command: 'model', value: pendingPrompt.modelChoice});
    }
    webSession.submit(pendingPrompt.line, pendingPrompt.attachments);
    setPendingPrompt(null);
  }, [pendingPrompt, sessionId, webSession.connected, webSession.busy, webSession]);

  async function refreshWorkspace(nextOrgId: string, nextProjectId: string, nextSessionId?: string) {
    const nextOrgs = await listOrganizations();
    const effectiveOrgId = nextOrgs.some((org) => org.id === nextOrgId) ? nextOrgId : nextOrgs[0]?.id;
    if (!effectiveOrgId) {
      setOrgs([]);
      setSessions([]);
      setRuntime({});
      return;
    }
    const projects = await listProjects(effectiveOrgId);
    const effectiveProjectId = projects.some((project) => project.id === nextProjectId) ? nextProjectId : projects[0]?.id;
    if (!effectiveProjectId) {
      if (effectiveOrgId !== nextOrgId) {
        navigate(`/org/${effectiveOrgId}`, {replace: true});
      }
      setOrgs(nextOrgs);
      setSessions([]);
      setRuntime({});
      return;
    }
    if (effectiveOrgId !== nextOrgId || effectiveProjectId !== nextProjectId) {
      navigate(`/org/${effectiveOrgId}/project/${effectiveProjectId}`, {replace: true});
      return;
    }
    const [nextSessions, nextRuntime] = await Promise.all([
      listSessions(effectiveProjectId),
      runtimeStatus(effectiveProjectId).catch(() => ({})),
    ]);
    if (nextSessionId && !nextSessions.some((session) => session.id === nextSessionId)) {
      const fallbackSession = nextSessions[0];
      navigate(
        fallbackSession
          ? `/org/${nextOrgId}/project/${nextProjectId}/session/${fallbackSession.id}`
          : `/org/${nextOrgId}/project/${nextProjectId}`,
        {replace: true},
      );
      return;
    }
    setOrgs(nextOrgs);
    setSessions(nextSessions);
    setRuntime(nextRuntime);
  }

  const transcript = mergeTranscript(initialMessages, webSession.transcript);
  const toolEvents = mergeToolEvents(initialToolEvents, webSession.toolEvents);
  const hasMessages = transcript.length > 0 || Boolean(webSession.assistantBuffer);
  const activeOrg = orgs.find((org) => org.id === orgId)?.name ?? 'OpenHarness';
  const composerStatus = sessionId ? webSession.status : runtime;

  function handleNewSession() {
    setPendingPrompt(null);
    setInitialMessages([]);
    navigate(`/org/${orgId}/project/${projectId}`);
  }

  async function handleSubmit(line: string, files?: File[]) {
    if (sessionId) {
      const attachments = files?.length ? (await uploadSessionAttachments(sessionId, files)).attachments : undefined;
      webSession.submit(line, attachments);
      return;
    }
    const title = line.trim().slice(0, 60) || files?.[0]?.name || 'New chat';
    const created = await createSession(orgId, projectId, title);
    const attachments = files?.length ? (await uploadSessionAttachments(created.id, files)).attachments : undefined;
    setPendingPrompt({sessionId: created.id, line, attachments, modelChoice});
    await refreshWorkspace(orgId, projectId);
    navigate(`/org/${orgId}/project/${projectId}/session/${created.id}`);
  }

  async function handleRename(session: SessionRecord, title: string) {
    const nextTitle = title.trim();
    if (!nextTitle || nextTitle === session.title) {
      return;
    }
    await updateSession(session.id, {title: nextTitle});
    await refreshWorkspace(orgId, projectId);
  }

  async function handlePin(session: SessionRecord) {
    await updateSession(session.id, {pinned: !session.pinned});
    await refreshWorkspace(orgId, projectId);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) {
      return;
    }
    const deletedId = deleteTarget.id;
    await deleteSession(deletedId);
    setDeleteTarget(null);
    await refreshWorkspace(orgId, projectId);
    if (deletedId === sessionId) {
      navigate(`/org/${orgId}/project/${projectId}`);
    }
  }

  const composerDisabled = sessionId ? !webSession.connected : false;

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        orgId={orgId}
        projectId={projectId}
        sessionId={sessionId}
        sessions={sessions}
        activeOrg={activeOrg}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
        onNewSession={handleNewSession}
        onRename={handleRename}
        onPin={handlePin}
        onDeleteRequest={setDeleteTarget}
      />
      <main className={`chat-shell ${hasMessages ? 'has-messages' : 'is-empty'}`}>
        <Conversation
          transcript={transcript}
          assistantBuffer={webSession.assistantBuffer}
          connected={sessionId ? webSession.connected : true}
          status={webSession.status}
          busy={Boolean(pendingPrompt) || webSession.busy}
          toolEvents={toolEvents}
          greeting={greeting}
          loading={Boolean(sessionId) && !sessionLoaded}
          onSelectTool={setSelectedTool}
        />
        <Composer
          hasMessages={hasMessages}
          disabled={composerDisabled}
          busy={Boolean(pendingPrompt) || webSession.busy}
          status={composerStatus}
          modelChoice={modelChoice}
          onModelChoiceChange={setModelChoice}
          onSubmit={handleSubmit}
          onStop={webSession.stop}
          onApplyCommand={(command, value) => {
            if (command === 'model') {
              setModelChoice(value);
            }
            if (sessionId) {
              webSession.send({type: 'apply_select_command', request_id: newRequestId(), command, value});
            }
          }}
        />
      </main>
      <Inspector status={webSession.status} tasks={webSession.tasks} events={webSession.events} runtime={runtime} />
      <ToolDrawer tool={selectedTool} onClose={() => setSelectedTool(null)} />
      <DeleteDialog target={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={handleConfirmDelete} />
      <ModalLayer
        modal={webSession.modal}
        selectRequest={webSession.selectRequest}
        onClose={() => {
          webSession.setModal(null);
          webSession.setSelectRequest(null);
        }}
        onPermission={(requestId, allowed) => {
          webSession.send({type: 'permission_response', request_id: requestId, allowed});
          webSession.setModal(null);
        }}
        onQuestion={(requestId, answer) => {
          webSession.send({type: 'question_response', request_id: requestId, answer});
          webSession.setModal(null);
        }}
        onSelect={(command, option) => {
          webSession.send({type: 'apply_select_command', request_id: newRequestId(), command, value: option.value});
          webSession.setSelectRequest(null);
        }}
      />
    </div>
  );
}

function Sidebar({
  orgId,
  projectId,
  sessionId,
  sessions,
  activeOrg,
  collapsed,
  onToggleCollapsed,
  onNewSession,
  onRename,
  onPin,
  onDeleteRequest,
}: {
  orgId: string;
  projectId: string;
  sessionId?: string;
  sessions: SessionRecord[];
  activeOrg: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNewSession: () => void;
  onRename: (session: SessionRecord, title: string) => void;
  onPin: (session: SessionRecord) => void;
  onDeleteRequest: (session: SessionRecord) => void;
}) {
  const navigate = useNavigate();
  const [menuState, setMenuState] = useState<MenuState>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const groupedSessions = useMemo(() => groupSessionsByMonth(sessions), [sessions]);

  function openMenu(session: SessionRecord, element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const left = Math.max(8, rect.right - 142);
    const top = Math.min(rect.bottom + 6, window.innerHeight - 132);
    setMenuState({session, top, left});
  }

  function startRename(session: SessionRecord) {
    setMenuState(null);
    setEditingId(session.id);
    setEditingTitle(session.title);
  }

  function commitRename(session: SessionRecord) {
    if (editingId !== session.id) {
      return;
    }
    setEditingId(null);
    void onRename(session, editingTitle);
  }

  return (
    <aside className="sidebar">
      {menuState ? <button className="floating-dismiss-layer" onClick={() => setMenuState(null)} aria-label={UI.close} /> : null}
      <div className="brand-row">
        <div className="brand-lockup">
          <div className="brand-mark"><Bot size={22} /></div>
          <strong>openharness</strong>
        </div>
        <button
          className="sidebar-toggle"
          title={collapsed ? UI.expandSidebar : UI.collapseSidebar}
          aria-label={collapsed ? UI.expandSidebar : UI.collapseSidebar}
          onClick={onToggleCollapsed}
        >
          {collapsed ? <PanelRightOpen size={22} /> : <PanelLeft size={22} />}
        </button>
      </div>
      <button className="new-chat" onClick={onNewSession} title={UI.newChat}>
        <MessageSquarePlus size={21} />
        <span>{UI.newChat}</span>
      </button>
      <section className="nav-section session-list">
        {groupedSessions.map((group) => (
          <div className="session-month" key={group.label}>
            <div className="section-label">{group.label}</div>
            {group.items.map((session) => (
              <div key={session.id} className={`session-row ${session.id === sessionId ? 'active' : ''}`}>
                {editingId === session.id ? (
                  <input
                    className="rename-input"
                    value={editingTitle}
                    autoFocus
                    onChange={(event) => setEditingTitle(event.target.value)}
                    onBlur={() => commitRename(session)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.currentTarget.blur();
                      }
                      if (event.key === 'Escape') {
                        setEditingId(null);
                        setEditingTitle('');
                      }
                    }}
                  />
                ) : (
                  <button
                    className="list-row"
                    onClick={() => navigate(`/org/${orgId}/project/${projectId}/session/${session.id}`)}
                    title={session.title}
                  >
                    <span>{session.pinned ? `${UI.pin} ` : ''}{session.title}</span>
                  </button>
                )}
                <button
                  className="session-menu-button"
                  title={UI.more}
                  onClick={(event) => {
                    event.stopPropagation();
                    openMenu(session, event.currentTarget);
                  }}
                >
                  <MoreHorizontal size={20} />
                </button>
              </div>
            ))}
          </div>
        ))}
      </section>
      {menuState ? (
        <div
          className="session-menu floating-session-menu"
          style={{top: menuState.top, left: menuState.left}}
          onClick={(event) => event.stopPropagation()}
        >
          <button onClick={() => startRename(menuState.session)}><Edit3 size={16} /> {UI.rename}</button>
          <button onClick={() => { setMenuState(null); onPin(menuState.session); }}>
            {menuState.session.pinned ? <PinOff size={16} /> : <Pin size={16} />}
            {menuState.session.pinned ? UI.unpin : UI.pin}
          </button>
          <button className="danger" onClick={() => { setMenuState(null); onDeleteRequest(menuState.session); }}><Trash2 size={16} /> {UI.delete}</button>
        </div>
      ) : null}
      <div className="sidebar-footer">
        <button className="user-menu" onClick={() => navigate('/settings')} title={activeOrg}>
          <div className="user-avatar">{activeOrg.slice(0, 1).toUpperCase()}</div>
          <span>{activeOrg}</span>
          <MoreHorizontal size={20} />
        </button>
      </div>
    </aside>
  );
}

function Conversation({
  transcript,
  assistantBuffer,
  connected,
  status,
  busy,
  toolEvents,
  greeting,
  loading,
  onSelectTool,
}: {
  transcript: TranscriptItem[];
  assistantBuffer: string;
  connected: boolean;
  status: Record<string, unknown>;
  busy: boolean;
  toolEvents: ToolFeedback[];
  greeting: string;
  loading: boolean;
  onSelectTool: (tool: ToolFeedback) => void;
}) {
  const visibleTranscript = transcript.filter(isVisibleChatItem);
  const lastAssistantIndex = findLastAssistantIndex(visibleTranscript);
  const answerToolEvents = compactToolEvents(toolEvents);
  const conversationRef = useRef<HTMLElement | null>(null);
  const latestVisibleMessage = visibleTranscript[visibleTranscript.length - 1];
  const scrollKey = [
    visibleTranscript.length,
    latestVisibleMessage?.id ?? '',
    latestVisibleMessage?.text.length ?? 0,
    assistantBuffer.length,
    busy ? 'busy' : 'idle',
    answerToolEvents.length,
  ].join(':');

  useLayoutEffect(() => {
    const element = conversationRef.current;
    if (!element) {
      return;
    }
    const scrollToBottom = () => {
      element.scrollTop = element.scrollHeight;
    };
    scrollToBottom();
    const frame = window.requestAnimationFrame(scrollToBottom);
    return () => window.cancelAnimationFrame(frame);
  }, [scrollKey]);

  if (!visibleTranscript.length && !assistantBuffer) {
    return (
      <section className="empty-state">
        {loading ? null : <h1>{greeting}</h1>}
        <div className="runtime-chip">
          <span className={`connection-dot ${connected ? 'online' : ''}`} />
          {loading ? UI.connecting : connected ? String(status.model ?? 'runtime ready') : UI.connecting}
        </div>
      </section>
    );
  }
  return (
    <section className="conversation" ref={conversationRef}>
      {visibleTranscript.map((item, index) => (
        <div key={`${index}-${item.role}`}>
          <MessageBubble item={item} />
          {index === lastAssistantIndex && answerToolEvents.length ? (
            <ToolFeedbackStrip toolEvents={answerToolEvents} onSelectTool={onSelectTool} />
          ) : null}
        </div>
      ))}
      {busy && !assistantBuffer ? <ThinkingBubble /> : null}
      {assistantBuffer ? <MessageBubble item={{role: 'assistant', text: assistantBuffer}} streaming /> : null}
    </section>
  );
}

function ThinkingBubble() {
  return (
    <article className="thinking-bubble">
      <span />
      <span />
      <span />
    </article>
  );
}

function ToolFeedbackStrip({toolEvents, onSelectTool}: {toolEvents: ToolFeedback[]; onSelectTool: (tool: ToolFeedback) => void}) {
  const recent = toolEvents.slice(-6);
  return (
    <div className="tool-strip">
      {recent.map((tool) => (
        <button key={tool.id} onClick={() => onSelectTool(tool)}>
          <Globe2 size={15} />
          {tool.is_error ? UI.toolFailed : UI.toolDone} {tool.tool_name}
        </button>
      ))}
    </div>
  );
}

function MessageBubble({item, streaming = false}: {item: TranscriptItem; streaming?: boolean}) {
  return (
    <article className={`message ${item.role} ${streaming ? 'streaming' : ''}`}>
      {item.role === 'assistant' ? <div className="message-avatar"><Bot size={16} /></div> : null}
      <div className="message-body">
        <MarkdownContent text={item.text} />
      </div>
    </article>
  );
}

function MarkdownContent({text}: {text: string}) {
  return (
    <div className="markdown-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

function Composer({
  hasMessages,
  disabled,
  busy,
  status,
  modelChoice,
  onModelChoiceChange,
  onSubmit,
  onStop,
  onApplyCommand,
}: {
  hasMessages: boolean;
  disabled: boolean;
  busy: boolean;
  status: Record<string, unknown>;
  modelChoice: string | null;
  onModelChoiceChange: (value: string) => void;
  onSubmit: (value: string, files?: File[]) => Promise<void>;
  onStop: () => void;
  onApplyCommand: (command: string, value: string) => void;
}) {
  const [value, setValue] = useState('');
  const [mode, setMode] = useState<EffortMode>('instant');
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [autoThinking, setAutoThinking] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const attachmentsRef = useRef<PendingAttachment[]>([]);

  const modelOptions = useMemo(() => normalizeModelOptions(status.model_options, String(status.model ?? '')), [status.model_options, status.model]);
  const selectedModel = modelOptions.find((option) => option.value === modelChoice) ?? modelOptions.find((option) => option.active) ?? modelOptions[0];
  const selectedModelValue = selectedModel?.value ?? modelChoice ?? 'default';

  useEffect(() => {
    const effort = String(status.effort ?? '');
    const nextMode = effort === 'high' ? 'pro' : effort === 'medium' ? 'thinking' : effort === 'low' ? 'instant' : null;
    if (nextMode) {
      setMode(nextMode);
    }
  }, [status.effort]);

  useEffect(() => {
    const active = modelOptions.find((option) => option.active && !option.disabled);
    if (active) {
      onModelChoiceChange(active.value);
    }
  }, [modelOptions, onModelChoiceChange]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = 'auto';
    const maxHeight = mode === 'instant' ? 104 : 132;
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [value, mode, attachments.length]);

  useEffect(() => () => {
    for (const attachment of attachmentsRef.current) {
      if (attachment.preview_url) {
        URL.revokeObjectURL(attachment.preview_url);
      }
    }
  }, []);

  async function submit(event: FormEvent | KeyboardEvent<HTMLTextAreaElement>) {
    event.preventDefault();
    const line = value.trim();
    if ((!line && !attachments.length) || uploading || busy) {
      return;
    }
    if (autoThinking && mode === 'instant' && shouldAutoSwitchToThinking(line, attachments)) {
      setMode('thinking');
      onApplyCommand('effort', 'medium');
    }
    setUploading(true);
    try {
      await onSubmit(value, attachments.map((attachment) => attachment.file));
      setValue('');
      setAttachments((items) => {
        for (const item of items) {
          if (item.preview_url) {
            URL.revokeObjectURL(item.preview_url);
          }
        }
        return [];
      });
    } finally {
      setUploading(false);
    }
  }

  function chooseMode(nextMode: EffortMode) {
    setMode(nextMode);
    setModeMenuOpen(false);
    onApplyCommand('effort', effortForMode(nextMode));
  }

  function closeExpandedMode() {
    chooseMode('instant');
  }

  function chooseModel(option: SelectOptionPayload) {
    if (option.disabled) {
      return;
    }
    onModelChoiceChange(option.value);
    setModelMenuOpen(false);
    onApplyCommand('model', option.value);
  }

  function handleFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }
    const nextItems = Array.from(files).map((file) => {
      const isImage = file.type.startsWith('image/');
      return {
        id: `pending_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`,
        name: file.name,
        mime_type: file.type || 'application/octet-stream',
        size: file.size,
        is_image: isImage,
        preview_url: isImage ? URL.createObjectURL(file) : null,
        file,
      };
    });
    setAttachments((items) => [...items, ...nextItems]);
    setAddMenuOpen(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function openFilePicker() {
    setAddMenuOpen(false);
    fileInputRef.current?.click();
  }

  const canSubmit = !disabled && !uploading && (Boolean(value.trim()) || attachments.length > 0);
  const modeLabel = labelForMode(mode);
  const expandedMode = mode === 'instant' ? null : {
    label: mode === 'pro' ? UI.proPillLabel : UI.thinkingPillLabel,
    title: modeLabel,
  };

  return (
    <form className="composer" onSubmit={submit}>
      {(addMenuOpen || modeMenuOpen) ? <button type="button" className="composer-dismiss-layer" aria-label={UI.close} onClick={() => { setAddMenuOpen(false); setModeMenuOpen(false); }} /> : null}
      <div className="composer-page-mode">
        <button
          type="button"
          className="page-mode-button"
          title={`${UI.chooseModel} Ctrl + M`}
          onClick={() => setModeMenuOpen((open) => !open)}
        >
          OpenHarness
          <ChevronDown size={16} />
        </button>
        {modeMenuOpen ? (
          <div className="composer-popover page-mode-popover">
            <span className="popover-caption">{UI.latest}</span>
            <button type="button" className={mode === 'instant' ? 'selected' : ''} onClick={() => chooseMode('instant')}>
              <span><strong>Instant</strong><small>{UI.instantDesc}</small></span>
              {mode === 'instant' ? <Check size={20} /> : null}
            </button>
            <button type="button" className={mode === 'thinking' ? 'selected' : ''} onClick={() => chooseMode('thinking')}>
              <span><strong>Thinking</strong><small>{UI.thinkingDesc}</small></span>
              {mode === 'thinking' ? <Check size={20} /> : null}
            </button>
            <button type="button" className={mode === 'pro' ? 'selected' : ''} onClick={() => chooseMode('pro')}>
              <span><strong>Pro</strong><small>{UI.proDesc}</small></span>
              {mode === 'pro' ? <Check size={20} /> : null}
            </button>
            <div className="popover-separator" />
            <button type="button" onClick={() => { setModeMenuOpen(false); setConfigOpen(true); }}>{UI.config}</button>
          </div>
        ) : null}
      </div>
      <div className="composer-box">
        <input
          ref={fileInputRef}
          className="hidden-file-input"
          type="file"
          multiple
          onChange={(event) => void handleFiles(event.target.files)}
        />
        <div className={`composer-main-row ${attachments.length ? 'has-attachments' : ''} ${expandedMode ? 'mode-active' : ''}`}>
          <div className="composer-add-wrap">
            <button
              type="button"
              className="composer-icon-button add"
              title={`${UI.addFiles} /`}
              disabled={disabled || uploading}
              onClick={() => setAddMenuOpen((open) => !open)}
            >
              <Plus size={25} />
            </button>
            {addMenuOpen ? (
              <div className="composer-popover add-popover">
                <button type="button" onClick={openFilePicker}><Paperclip size={22} /> {UI.addPhotosAndFiles}</button>
              </div>
            ) : null}
          </div>
          <div className="composer-input-stack">
            {attachments.length ? (
              <div className="attachment-preview-list">
                {attachments.map((attachment) => (
                  <div className="attachment-preview" key={attachment.id}>
                    {attachment.is_image && attachment.preview_url ? (
                      <img src={attachment.preview_url} alt={attachment.name} />
                    ) : (
                      <FileText size={25} />
                    )}
                    <button
                      type="button"
                      title={UI.delete}
                      onClick={() => {
                        if (attachment.preview_url) {
                          URL.revokeObjectURL(attachment.preview_url);
                        }
                        setAttachments((items) => items.filter((item) => item.id !== attachment.id));
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <textarea
              ref={textareaRef}
              disabled={disabled || uploading}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={uploading ? 'Uploading...' : UI.composerPlaceholder}
              rows={1}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'm') {
                  event.preventDefault();
                  setModeMenuOpen((open) => !open);
                }
                if (event.key === 'Enter' && !event.shiftKey) {
                  submit(event);
                }
              }}
            />
            {expandedMode ? (
              <div className={`composer-mode-panel ${mode}`} title={expandedMode.title}>
                <span className="mode-panel-icon" />
                <button type="button" className="mode-panel-close" aria-label={UI.close} title={UI.close} onClick={closeExpandedMode}>
                  <X size={15} />
                </button>
                <strong>{expandedMode.label}</strong>
              </div>
            ) : null}
          </div>
          <div className="composer-right-controls">
            <button type="button" className="composer-icon-button voice" title={UI.voiceOnly}><Mic size={23} /></button>
            {busy ? (
              <button type="button" className="send-button" onClick={onStop} title={UI.stop}><CircleStop size={21} /></button>
            ) : (
              <button type="submit" className="send-button" disabled={!canSubmit} title={UI.send}>
                <ArrowUp size={24} />
              </button>
            )}
          </div>
        </div>
        {hasMessages ? (
          <p className="composer-disclaimer">{UI.footerDisclaimer}</p>
        ) : (
          <div className="composer-feature-row">
            <button type="button" disabled><ImageIcon size={21} /> {UI.createImage}</button>
            <button type="button" disabled><Pencil size={21} /> {UI.writeEdit}</button>
            <button type="button" disabled><Globe2 size={21} /> {UI.search}</button>
          </div>
        )}
      </div>
      {configOpen ? (
        <div
          className="model-config-backdrop"
          onClick={() => {
            if (modelMenuOpen) {
              setModelMenuOpen(false);
              return;
            }
            setConfigOpen(false);
          }}
        >
          <div className="model-config-dialog" onClick={(event) => event.stopPropagation()}>
            <header>
              <h2>{UI.thinkingDuration}</h2>
              <button type="button" onClick={() => setConfigOpen(false)}><X size={24} /></button>
            </header>
            <section className="model-config-row">
              <span>{UI.model}</span>
              <div className="config-model-picker">
                <button type="button" onClick={() => setModelMenuOpen((open) => !open)}>
                  {selectedModel?.label ?? modelChoice}
                  <ChevronDown size={18} />
                </button>
                {modelMenuOpen ? (
                  <div className="model-choice-menu">
                    {modelOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        disabled={option.disabled}
                        className={selectedModelValue === option.value ? 'selected' : ''}
                        onClick={() => chooseModel(option)}
                      >
                        <span>
                          <strong>{option.label}{option.badge ? <small>{option.badge}</small> : null}</strong>
                          {option.description ? <small>{option.description}</small> : null}
                        </span>
                        {selectedModelValue === option.value ? <Check size={20} /> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
            <section className="config-mode-list">
              <button type="button" className={mode === 'instant' ? 'selected' : ''} onClick={() => chooseMode('instant')}>
                <span><strong>Instant <small>low</small></strong><small>{UI.instantDesc}</small></span>
                {mode === 'instant' ? <Check size={22} /> : null}
              </button>
              <button type="button" className={mode === 'thinking' ? 'selected' : ''} onClick={() => chooseMode('thinking')}>
                <span><strong>Thinking <small>medium</small></strong><small>{UI.thinkingDesc}</small></span>
                {mode === 'thinking' ? <Check size={22} /> : null}
              </button>
              <button type="button" className={mode === 'pro' ? 'selected' : ''} onClick={() => chooseMode('pro')}>
                <span><strong>Pro <small>high</small></strong><small>{UI.proDesc}</small></span>
                {mode === 'pro' ? <Check size={22} /> : null}
              </button>
            </section>
            <section className="auto-thinking-row">
              <div>
                <strong>{UI.autoThinking}</strong>
                <p>{UI.autoThinkingDesc}</p>
              </div>
              <button
                type="button"
                className={`toggle-switch ${autoThinking ? 'on' : ''}`}
                aria-pressed={autoThinking}
                onClick={() => setAutoThinking((enabled) => !enabled)}
              >
                <span />
              </button>
            </section>
          </div>
        </div>
      ) : null}
    </form>
  );
}

function normalizeModelOptions(rawOptions: unknown, currentModel: string): SelectOptionPayload[] {
  const options = Array.isArray(rawOptions)
    ? rawOptions
        .map((item) => item as Partial<SelectOptionPayload>)
        .filter((item): item is SelectOptionPayload => Boolean(item.value && item.label))
    : [];
  if (options.length) {
    return options;
  }
  const current = currentModel || 'kimi-k2.5';
  return [
    {value: current, label: current, description: 'Current model', active: true},
    {value: 'gpt-5.5', label: 'gpt-5.5', description: 'OpenAI model not configured for the active profile', disabled: true},
    {value: 'deepseek-v4', label: 'deepseek-v4', description: 'DeepSeek model not configured for the active profile', disabled: true},
    {value: 'deepseek-7B_local', label: 'deepseek-7B_local', description: 'Local model not configured', disabled: true, badge: 'Local'},
  ];
}

function labelForMode(mode: EffortMode) {
  if (mode === 'pro') {
    return 'Pro';
  }
  return mode === 'thinking' ? 'Thinking' : 'Instant';
}

function effortForMode(mode: EffortMode) {
  if (mode === 'pro') {
    return 'high';
  }
  return mode === 'thinking' ? 'medium' : 'low';
}

function shouldAutoSwitchToThinking(line: string, attachments: Array<{name: string}>) {
  const text = line.trim();
  if (attachments.length > 1 || text.length > 120) {
    return true;
  }
  return /复杂|分析|方案|实现|修改|测试|排查|为什么|原因|架构|性能|重构|错误|失败|完整|设计|对比|推理|证明|debug|refactor|implement|architecture|performance|root cause/i.test(text);
}

function mergeTranscript(initialMessages: TranscriptItem[], liveMessages: TranscriptItem[]) {
  const seen = new Set<string>();
  return [...initialMessages, ...liveMessages].filter((item) => {
    if (!item.id) {
      return true;
    }
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

function mergeToolEvents(initialEvents: ToolFeedback[], liveEvents: ToolFeedback[]) {
  const seen = new Set<string>();
  return [...initialEvents, ...liveEvents].filter((event) => {
    const key = event.id || `${event.phase}:${event.tool_name}:${event.created_at}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function compactToolEvents(events: ToolFeedback[]) {
  const completed = events.filter((event) => event.phase === 'completed');
  return completed.length ? completed : events;
}

function isVisibleChatItem(item: TranscriptItem) {
  if (item.role === 'tool' || item.role === 'tool_result' || item.role === 'log') {
    return false;
  }
  if (item.role === 'user' && item.text.trim().startsWith('/')) {
    return false;
  }
  if (item.role === 'system') {
    const text = item.text.trim();
    if (/^(Reasoning effort set|Model set|Provider profile set|Permission mode set|Theme set|Output style set|Pass count set|Fast mode)/i.test(text)) {
      return false;
    }
  }
  return true;
}

function findLastAssistantIndex(items: TranscriptItem[]) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index].role === 'assistant') {
      return index;
    }
  }
  return -1;
}

function ToolDrawer({tool, onClose}: {tool: ToolFeedback | null; onClose: () => void}) {
  if (!tool) {
    return null;
  }
  const links = extractToolLinks(tool);
  return (
    <aside className="tool-drawer">
      <header>
        <div>
          <span>{tool.phase === 'started' ? UI.toolRunningTitle : tool.is_error ? UI.toolFailedTitle : UI.toolDoneTitle}</span>
          <h2>{tool.tool_name}</h2>
        </div>
        <button onClick={onClose} title={UI.close}><X size={18} /></button>
      </header>
      <section>
        <h3>{UI.input}</h3>
        <pre>{JSON.stringify(tool.tool_input ?? {}, null, 2)}</pre>
      </section>
      {links.length ? (
        <section>
          <h3>Sources</h3>
          <div className="source-list">
            {links.map((link) => (
              <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
                <span>{link.hostname}</span>
                <strong>{link.label}</strong>
              </a>
            ))}
          </div>
        </section>
      ) : null}
      <section>
        <h3>{UI.output}</h3>
        <pre>{tool.output || UI.waitingTool}</pre>
      </section>
    </aside>
  );
}

function extractToolLinks(tool: ToolFeedback) {
  const source = `${JSON.stringify(tool.tool_input ?? {})}\n${tool.output ?? ''}`;
  const matches = source.match(/https?:\/\/[^\s"'<>),\]]+/g) ?? [];
  const seen = new Set<string>();
  return matches.flatMap((raw) => {
    const href = raw.replace(/[.;]+$/, '');
    if (seen.has(href)) {
      return [];
    }
    seen.add(href);
    try {
      const url = new URL(href);
      return [{href, hostname: url.hostname.replace(/^www\./, ''), label: decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || url.hostname)}];
    } catch {
      return [];
    }
  });
}


function DeleteDialog({
  target,
  onCancel,
  onConfirm,
}: {
  target: SessionRecord | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!target) {
    return null;
  }
  return (
    <div className="delete-backdrop" onClick={onCancel}>
      <section className="delete-dialog" onClick={(event) => event.stopPropagation()}>
        <button className="delete-close" onClick={onCancel} title={UI.close}><X size={16} /></button>
        <div className="delete-icon"><Trash2 size={22} /></div>
        <h2>{UI.deleteTitle}</h2>
        <p>{UI.deleteBodyPrefix}</p>
        <strong>{target.title}</strong>
        <div className="delete-actions">
          <button onClick={onCancel}>{UI.cancel}</button>
          <button className="danger" onClick={onConfirm}>{UI.confirmDelete}</button>
        </div>
      </section>
    </div>
  );
}

function Inspector({
  status,
  tasks,
  events,
  runtime,
}: {
  status: Record<string, unknown>;
  tasks: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  runtime: Record<string, unknown>;
}) {
  return (
    <aside className="inspector">
      <section>
        <h2>Runtime</h2>
        <Info label="Model" value={status.model} />
        <Info label="Provider" value={status.provider} />
        <Info label="Permissions" value={status.permission_mode} />
        <Info label="Auth" value={status.auth_status} />
      </section>
      <section>
        <h2>Budget</h2>
        <Info label="Sandbox" value={(runtime.sandbox_root as string) ?? 'pending'} />
        <Info label="Daily limit" value={(runtime.budget as any)?.daily_token_limit} />
      </section>
      <section>
        <h2>Tasks</h2>
        {tasks.length ? tasks.map((task) => <p key={String(task.id)}>{String(task.status)} - {String(task.description)}</p>) : <p>No background tasks.</p>}
      </section>
      <section>
        <h2>Event log</h2>
        <div className="event-log">
          {events.slice(-10).map((event) => <span key={String(event.event_id)}>{String(event.type)}</span>)}
        </div>
      </section>
    </aside>
  );
}

function Info({label, value}: {label: string; value: unknown}) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <strong>{value == null || value === '' ? '-' : String(value)}</strong>
    </div>
  );
}

function groupSessionsByMonth(sessions: SessionRecord[]) {
  const formatter = new Intl.DateTimeFormat('zh-CN', {year: 'numeric', month: 'long'});
  const groups = new Map<string, SessionRecord[]>();
  for (const session of sessions) {
    const label = formatter.format(new Date(session.updated_at));
    groups.set(label, [...(groups.get(label) ?? []), session]);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({label, items}));
}

function ModalLayer({
  modal,
  selectRequest,
  onClose,
  onPermission,
  onQuestion,
  onSelect,
}: {
  modal: Record<string, unknown> | null;
  selectRequest: {title: string; command: string; options: SelectOptionPayload[]} | null;
  onClose: () => void;
  onPermission: (requestId: string, allowed: boolean) => void;
  onQuestion: (requestId: string, answer: string) => void;
  onSelect: (command: string, option: SelectOptionPayload) => void;
}) {
  const [answer, setAnswer] = useState('');
  if (!modal && !selectRequest) {
    return null;
  }
  const kind = String(modal?.kind ?? '');
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={16} /></button>
        {kind === 'permission' ? (
          <>
            <KeyRound size={22} />
            <h2>Approve tool call?</h2>
            <p><strong>{String(modal?.tool_name ?? 'tool')}</strong></p>
            <p>{String(modal?.reason ?? '')}</p>
            <div className="modal-actions">
              <button onClick={() => onPermission(String(modal?.request_id), false)}>Deny</button>
              <button className="primary" onClick={() => onPermission(String(modal?.request_id), true)}><Check size={16} /> Allow</button>
            </div>
          </>
        ) : kind === 'question' ? (
          <>
            <h2>{String(modal?.question ?? 'Question')}</h2>
            <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} autoFocus />
            <div className="modal-actions">
              <button onClick={onClose}>Cancel</button>
              <button className="primary" onClick={() => onQuestion(String(modal?.request_id), answer)}>Submit</button>
            </div>
          </>
        ) : selectRequest ? (
          <>
            <h2>{selectRequest.title}</h2>
            <div className="select-options">
              {selectRequest.options.map((option) => (
                <button
                  key={option.value}
                  disabled={option.disabled}
                  className={option.active ? 'active' : ''}
                  onClick={() => {
                    if (!option.disabled) {
                      onSelect(selectRequest.command, option);
                    }
                  }}
                >
                  <strong>{option.label}</strong>
                  {option.description ? <span>{option.description}</span> : null}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
