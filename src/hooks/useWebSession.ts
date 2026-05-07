import {useCallback, useEffect, useRef, useState} from 'react';

import {newRequestId, webSocketUrl} from '../api';
import type {SelectOptionPayload, TaskSnapshot, ToolFeedback, TranscriptItem, UploadedAttachment, WebBackendEvent, WebFrontendRequest} from '../types';

type SelectRequest = {
  title: string;
  command: string;
  options: SelectOptionPayload[];
};

export function useWebSession(sessionId?: string) {
  const [events, setEvents] = useState<WebBackendEvent[]>([]);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [assistantBuffer, setAssistantBuffer] = useState('');
  const [status, setStatus] = useState<Record<string, unknown>>({});
  const [tasks, setTasks] = useState<TaskSnapshot[]>([]);
  const [toolEvents, setToolEvents] = useState<ToolFeedback[]>([]);
  const [commands, setCommands] = useState<string[]>([]);
  const [modal, setModal] = useState<Record<string, unknown> | null>(null);
  const [selectRequest, setSelectRequest] = useState<SelectRequest | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const bufferRef = useRef('');

  const send = useCallback((payload: WebFrontendRequest) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  }, []);

  useEffect(() => {
    setEvents([]);
    setTranscript([]);
    setAssistantBuffer('');
    setStatus({});
    setTasks([]);
    setToolEvents([]);
    setCommands([]);
    setModal(null);
    setSelectRequest(null);
    setConnected(false);
    setBusy(false);
    bufferRef.current = '';
    if (!sessionId) {
      return;
    }
    const socket = new WebSocket(webSocketUrl(sessionId));
    socketRef.current = socket;
    socket.onopen = () => setConnected(true);
    socket.onclose = () => {
      setConnected(false);
      setBusy(false);
    };
    socket.onerror = () => {
      setConnected(false);
      setBusy(false);
    };
    socket.onmessage = (message) => {
      const event = JSON.parse(message.data) as WebBackendEvent;
      setEvents((items) => [...items, event].slice(-300));
      handleEvent(event);
    };
    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [sessionId]);

  const handleEvent = (event: WebBackendEvent) => {
    if (event.type === 'ready') {
      setStatus(event.state ?? {});
      setTasks(event.tasks ?? []);
      setCommands(event.commands ?? []);
      if (typeof event.state?.busy === 'boolean') {
        setBusy(event.state.busy);
      }
      if (typeof event.state?.assistant_buffer === 'string') {
        bufferRef.current = event.state.assistant_buffer;
        setAssistantBuffer(event.state.assistant_buffer);
      }
      return;
    }
    if (event.type === 'state_snapshot') {
      setStatus(event.state ?? {});
      if (typeof event.state?.busy === 'boolean') {
        setBusy(event.state.busy);
      }
      if (typeof event.state?.assistant_buffer === 'string') {
        bufferRef.current = event.state.assistant_buffer;
        setAssistantBuffer(event.state.assistant_buffer);
      }
      return;
    }
    if (event.type === 'tasks_snapshot') {
      setTasks(event.tasks ?? []);
      return;
    }
    if (event.type === 'transcript_item' && event.item) {
      setTranscript((items) => [...items, event.item as TranscriptItem]);
      return;
    }
    if (event.type === 'assistant_delta') {
      bufferRef.current += event.message ?? '';
      setAssistantBuffer(bufferRef.current);
      return;
    }
    if (event.type === 'assistant_complete') {
      const text = event.message ?? bufferRef.current;
      setTranscript((items) => [...items, event.item ?? {role: 'assistant', text}]);
      bufferRef.current = '';
      setAssistantBuffer('');
      setBusy(false);
      return;
    }
    if (event.type === 'tool_started' || event.type === 'tool_completed') {
      setToolEvents((items) => [
        ...items,
        {
          id: event.event_id,
          phase: event.type === 'tool_started' ? 'started' : 'completed',
          tool_name: event.tool_name ?? 'tool',
          tool_input: event.tool_input,
          output: event.output,
          is_error: event.is_error,
          created_at: event.created_at,
        },
      ]);
      return;
    }
    if (event.type === 'modal_request') {
      setModal(event.modal ?? null);
      return;
    }
    if (event.type === 'select_request') {
      const modal = event.modal ?? {};
      setSelectRequest({
        title: String(modal.title ?? 'Select'),
        command: String(modal.command ?? ''),
        options: event.select_options ?? [],
      });
      return;
    }
    if (event.type === 'error') {
      setTranscript((items) => [...items, {role: 'system', text: `error: ${event.message ?? 'unknown error'}`}]);
      bufferRef.current = '';
      setAssistantBuffer('');
      setBusy(false);
      return;
    }
    if (event.type === 'line_complete') {
      bufferRef.current = '';
      setAssistantBuffer('');
      setBusy(false);
    }
  };

  const submit = useCallback((line: string, attachments?: UploadedAttachment[]) => {
    if ((!line.trim() && !attachments?.length) || busy || !connected) {
      return;
    }
    send({type: 'submit_line', request_id: newRequestId(), line, attachments});
    setBusy(true);
  }, [busy, connected, send]);

  const stop = useCallback(() => {
    send({type: 'stop', request_id: newRequestId()});
    setBusy(false);
  }, [send]);

  return {
    events,
    transcript,
    assistantBuffer,
    status,
    tasks,
    toolEvents,
    commands,
    modal,
    selectRequest,
    connected,
    busy,
    setModal,
    setSelectRequest,
    send,
    submit,
    stop,
  };
}
