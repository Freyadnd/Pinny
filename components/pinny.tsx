"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUp,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronDown,
  Compass,
  Download,
  ExternalLink,
  Headphones,
  MapPin,
  Mic,
  MicOff,
  Plus,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  X,
  Footprints,
  Clock,
  CalendarDays,
  Coffee,
  Utensils,
} from "lucide-react";
import {
  State,
  Mode,
  Message,
  SavedPlace,
  emptyState,
  mapsUrl,
  directionsUrl,
  httpUrl,
} from "@/lib/model";
import {
  loadState,
  saveState,
  storageKey,
  browserStorage,
} from "@/lib/persistence";
import { demoState } from "@/lib/demo";
import { converse } from "@/lib/conversation";
import { kind } from "@/lib/recommend";
import { calendarFile, scheduleLabel } from "@/lib/calendar";
import { speechConstructor, SpeechRecognizer } from "@/lib/voice";
import { MAX_BACKUP_BYTES, PersonalBackup, readBackup, writeBackup, mergeBackup } from "@/lib/transfer";
import { PlaceArt, EmptyPlanArt } from "./art";

type Candidate = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  attributions?: { provider?: string; providerUri?: string }[];
};
type VoiceStatus = "idle" | "listening" | "unsupported" | "denied" | "error";
const prompts = [
  "I want spicy food alone under $25.",
  "Coffee, then a walk.",
  "A quiet coffee and a little me-time.",
];
const sourceName = (url: string) => {
  const host = new URL(url).hostname.replace(/^www\./, "");
  return host.includes("tiktok")
    ? "TikTok"
    : host.includes("xiaohongshu") || host.includes("rednote")
      ? "Rednote"
      : host;
};
export default function Pinny() {
  const [state, setState] = useState<State>(emptyState);
  const [mode, setMode] = useState<Mode>("demo");
  const [ready, setReady] = useState(false);
  const [writable, setWritable] = useState(true);
  const [storageWarning, setStorageWarning] = useState("");
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [voice, setVoice] = useState<VoiceStatus>("idle");
  const [voiceMessage, setVoiceMessage] = useState("");
  const [inspirationOpen, setInspirationOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [undo, setUndo] = useState<State | null>(null);
  const [notice, setNotice] = useState("");
  const [google, setGoogle] = useState(false);
  const [googleSearch, setGoogleSearch] = useState<{
    id: string;
    loading: boolean;
    error?: string;
    candidates: Candidate[];
  } | null>(null);
  const [noteEdit, setNoteEdit] = useState<{ id: string; note: string } | null>(
    null,
  );
  const [locationStatus, setLocationStatus] = useState("");
  const [origin, setOrigin] = useState("");
  const [crossTab, setCrossTab] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<PersonalBackup | null>(null);
  const [transferStatus, setTransferStatus] = useState("");
  const backupInput = useRef<HTMLInputElement>(null);
  const conflict = useRef(false);
  const recognition = useRef<SpeechRecognizer | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const submitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ state, mode, writable });
  const dialogRef = useRef<HTMLDialogElement>(null);
  const placesRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    let canceled = false;
    queueMicrotask(() => {
      if (canceled) return;
      let initialMode: Mode = "demo";
      try {
        if (localStorage.getItem("pinny:mode") === "live") initialMode = "live";
      } catch {}
      const result = loadState(browserStorage(), initialMode);
      setMode(initialMode);
      setState(result.state);
      setWritable(result.writable);
      setStorageWarning(result.warning || "");
      setReady(true);
      if (result.writable && result.fresh) {
        const warning = saveState(browserStorage(), initialMode, result.state);
        if (warning) setStorageWarning(warning);
      }
      if (!speechConstructor()) setVoice("unsupported");
    });
    fetch("/api/capabilities")
      .then((r) => r.json())
      .then((data) => {
        if (!canceled) setGoogle(data.googlePlaces === true);
      })
      .catch(() => {});
    return () => {
      canceled = true;
      recognition.current?.abort();
      placesRequest.current?.abort();
      if (submitTimer.current) clearTimeout(submitTimer.current);
    };
  }, []);
  useEffect(() => {
    latest.current = { state, mode, writable };
  }, [state, mode, writable]);
  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key === storageKey(mode) || event.key === null) {
        conflict.current = true;
        setCrossTab(true);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [mode]);
  useEffect(() => {
    if (state.messages.length)
      bottomRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
  }, [state.messages.length, processing]);
  useEffect(() => {
    if (inspirationOpen || resetOpen || settingsOpen)
      dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [inspirationOpen, resetOpen, settingsOpen]);
  function commit(next: State, undoable = true) {
    if (conflict.current && !resetOpen) {
      setNotice(
        "Reload saved data before making changes; another tab updated this workspace.",
      );
      return;
    }
    const current = latest.current;
    if (undoable) setUndo(current.state);
    setState(next);
    latest.current = { ...current, state: next };
    if (current.writable) {
      try {
        setStorageWarning(
          saveState(browserStorage(), current.mode, next) || "",
        );
      } catch {
        setStorageWarning(
          "Storage is unavailable. Your changes stay in this tab.",
        );
      }
    }
  }
  function closeDialog() {
    placesRequest.current?.abort();
    setInspirationOpen(false);
    setResetOpen(false);
    setSettingsOpen(false);
    setGoogleSearch(null);
    setNoteEdit(null);
    setPendingBackup(null);
    setTransferStatus("");
  }
  function switchMode() {
    recognition.current?.abort();
    placesRequest.current?.abort();
    if (submitTimer.current) clearTimeout(submitTimer.current);
    setProcessing(false);
    const nextMode: Mode = mode === "demo" ? "live" : "demo";
    const result = loadState(browserStorage(), nextMode);
    latest.current = {
      state: result.state,
      mode: nextMode,
      writable: result.writable,
    };
    setState(result.state);
    setMode(nextMode);
    setWritable(result.writable);
    setStorageWarning(result.warning || "");
    setUndo(null);
    setInput("");
    setOrigin("");
    setLocationStatus("");
    setNotice("");
    conflict.current = false;
    setCrossTab(false);
    closeDialog();
    try {
      localStorage.setItem("pinny:mode", nextMode);
      if (result.writable && result.fresh)
        setStorageWarning(
          saveState(browserStorage(), nextMode, result.state) || "",
        );
    } catch {
      setStorageWarning(
        "Storage is unavailable. This workspace will stay in this tab only.",
      );
    }
  }
  function submit(text = input) {
    if (!ready || processing || !text.trim() || crossTab) return;
    recognition.current?.stop();
    setVoiceMessage("");
    setInput("");
    setProcessing(true);
    setNotice("");
    submitTimer.current = setTimeout(() => {
      const next = converse(latest.current.state, text);
      if (latest.current.mode === "demo")
        next.places = next.places.map((p) => ({ ...p, sample: true }));
      commit(next);
      setProcessing(false);
      inputRef.current?.focus();
    }, 240);
  }
  function draft(text: string) {
    closeDialog();
    setInput(text);
    setTimeout(() => inputRef.current?.focus(), 0);
  }
  function startVoice() {
    if (voice === "listening") {
      recognition.current?.stop();
      return;
    }
    const Constructor = speechConstructor();
    if (!Constructor) {
      setVoice("unsupported");
      setVoiceMessage(
        "Voice is unavailable in this browser. You can always type below.",
      );
      return;
    }
    try {
      const r = new Constructor();
      recognition.current = r;
      r.lang = "en-US";
      r.continuous = false;
      r.interimResults = true;
      const prefix = input.trim();
      let failed = false;
      r.onresult = (event) => {
        let text = "";
        for (let i = 0; i < event.results.length; i++)
          text += event.results[i][0].transcript;
        setInput(`${prefix}${prefix ? " " : ""}${text}`.slice(0, 2000));
      };
      r.onerror = (event) => {
        failed = true;
        setVoice(
          event.error === "not-allowed" || event.error === "service-not-allowed"
            ? "denied"
            : "error",
        );
        setVoiceMessage(
          event.error === "not-allowed" || event.error === "service-not-allowed"
            ? "Microphone permission was denied. Type your request, or enable microphone access in your browser."
            : event.error === "no-speech"
              ? "No speech detected. Try again, or type your request."
              : "Voice recognition couldn’t finish. Your text is still editable.",
        );
      };
      r.onend = () => {
        if (!failed) {
          setVoice("idle");
          setVoiceMessage(
            "Transcription ready. Edit it, then send when you’re happy.",
          );
        }
        inputRef.current?.focus();
      };
      r.start();
      setVoice("listening");
      setVoiceMessage(
        "Listening… tap the microphone to stop. Nothing sends automatically.",
      );
    } catch {
      setVoice("error");
      setVoiceMessage(
        "Couldn’t start the microphone. Try again, or type your request.",
      );
    }
  }
  function choose(place: SavedPlace) {
    submit(`Choose ${place.name}.`);
  }
  function undoLast() {
    if (undo) {
      const previous = undo;
      commit(previous, false);
      setUndo(null);
      setNotice("Undone. Your earlier data is restored.");
    }
  }
  function deletePlace(place: SavedPlace) {
    const next = structuredClone(state);
    next.places = next.places.filter((p) => p.id !== place.id);
    next.plan = next.plan.filter((p) => p.savedPlaceId !== place.id);
    next.visits = next.visits.filter((v) => v.savedPlaceId !== place.id);
    next.context.candidateIds = next.context.candidateIds.filter(
      (id) => id !== place.id,
    );
    if (next.context.selectedId === place.id)
      next.context.selectedId = undefined;
    next.schedule = null;
    commit(next);
    setNotice(`Removed ${place.name} and its experiences. Undo restores both.`);
  }
  function exportCalendar() {
    try {
      const blob = new Blob([calendarFile(state)], {
        type: "text/calendar;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pinny-outing.ics";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(
        "Calendar file downloaded. Open it in your calendar app to add the event.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Confirm your time first.",
      );
    }
  }
  function exportPersonalData() {
    try {
      const url = URL.createObjectURL(new Blob([writeBackup(latest.current.state)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "pinny-personal-backup.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setTransferStatus("Backup downloaded. Keep it private: it contains your notes and experiences.");
    } catch (error) {
      setTransferStatus(error instanceof Error ? error.message : "Could not export data.");
    }
  }
  async function chooseBackup(file?: File) {
    setPendingBackup(null);
    setTransferStatus("");
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error("Choose a Pinny JSON backup smaller than 2 MB.");
      const backup = readBackup(await file.text());
      if (latest.current.mode !== "live" || !dialogRef.current?.open) return;
      setPendingBackup(backup);
    } catch (error) {
      setTransferStatus(error instanceof Error ? error.message : "Could not read this backup.");
    }
  }
  function importPersonalData() {
    if (!pendingBackup || latest.current.mode !== "live" || conflict.current || !latest.current.writable) return;
    try {
      commit(mergeBackup(latest.current.state, pendingBackup));
      setPendingBackup(null);
      setTransferStatus("Backup merged. Your existing places, experiences, and current plan were kept. Undo is available after closing this drawer.");
    } catch (error) {
      setTransferStatus(error instanceof Error ? error.message : "Import failed; existing data was kept.");
    }
  }
  async function searchGoogle(place: SavedPlace) {
    placesRequest.current?.abort();
    const controller = new AbortController();
    placesRequest.current = controller;
    const timeout = setTimeout(() => controller.abort(), 10000);
    setGoogleSearch({ id: place.id, loading: true, candidates: [] });
    try {
      const r = await fetch("/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: place.name, city: place.city }),
        signal: controller.signal,
      });
      const data = await r.json();
      if (controller.signal.aborted) return;
      if (!r.ok) throw new Error(data.error || "Google Places search failed.");
      setGoogleSearch({
        id: place.id,
        loading: false,
        candidates: data.candidates,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        if (placesRequest.current === controller)
          setGoogleSearch((current) =>
            current?.id === place.id
              ? {
                  ...current,
                  loading: false,
                  error:
                    "Google search was canceled or timed out. Continue with saved inspiration.",
                  candidates: [],
                }
              : null,
          );
        return;
      }
      setGoogleSearch({
        id: place.id,
        loading: false,
        candidates: [],
        error:
          error instanceof Error
            ? error.message
            : "Google Places search failed.",
      });
    } finally {
      clearTimeout(timeout);
    }
  }
  function confirmGoogle(place: SavedPlace, candidate: Candidate) {
    const duplicate = state.places.find(
      (p) => p.id !== place.id && p.placeId === candidate.id,
    );
    if (duplicate) {
      setGoogleSearch({
        ...googleSearch!,
        loading: false,
        error: `That ID is already attached to ${duplicate.name}. Keep your inspiration separate or merge it before matching.`,
        candidates: [],
      });
      return;
    }
    const next = structuredClone(state);
    next.places = next.places.map((p) =>
      p.id === place.id ? { ...p, placeId: candidate.id } : p,
    );
    commit(next);
    setGoogleSearch(null);
    setNotice(
      "Confirmed Google place ID saved. Google addresses and coordinates were not saved.",
    );
  }
  function locate() {
    if (!navigator.geolocation) {
      setLocationStatus(
        "Location is unsupported. Tell Pinny your city instead.",
      );
      return;
    }
    setLocationStatus("Requesting location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin(`${position.coords.latitude},${position.coords.longitude}`);
        setLocationStatus(
          "Current location will be used as your Maps starting point for this tab only. Tell Pinny your city to match inspiration.",
        );
      },
      (error) => {
        setLocationStatus(
          error.code === 1
            ? "Location permission denied. Tell Pinny your city; everything still works."
            : "Couldn’t get your location. Tell Pinny your city instead.",
        );
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  }
  const planPlaces = state.plan
    .map((s) => ({
      stop: s,
      place: state.places.find((p) => p.id === s.savedPlaceId),
    }))
    .filter(
      (p): p is { stop: State["plan"][number]; place: SavedPlace } => !!p.place,
    );
  const total = state.plan.reduce((sum, s) => sum + s.duration, 0);
  const activePlace = state.places.find(
    (p) => p.id === state.context.selectedId,
  );
  const activeExperience = activePlace
    ? state.visits.filter((v) => v.savedPlaceId === activePlace.id).at(-1)
    : undefined;
  function renderPlanCard(compact = false) {
    return (
      <div className={compact ? "compact-plan" : "inline-plan"}>
        {planPlaces.map(({ stop, place }, index) => (
          <div key={place.id} className="plan-stop">
            <span className="stop-number">{index + 1}</span>
            <div className="stop-copy">
              <strong>{place.name}</strong>
              <span>
                {place.neighborhood || place.city} · ~{stop.duration} min
              </span>
            </div>
            <a
              href={directionsUrl(place, origin || state.settings.location)}
              target="_blank"
              rel="noopener noreferrer"
              className="icon-button"
              aria-label={`${place.placeId ? "Directions to" : "Find directions to"} ${place.name}`}
              title={
                place.placeId
                  ? "Directions"
                  : "Find in Maps — verify the destination"
              }
            >
              <ArrowUpRight size={18} />
            </a>
          </div>
        ))}
        <div className="plan-summary">
          <Clock size={14} />
          <span>~{total} min of activities · travel extra</span>
        </div>
        {!compact && (
          <p className="fine-print">
            {state.plan.length > 1
              ? "Stop order is your choice, not an optimized route. "
              : ""}
            Verify destinations, hours, and availability in Maps.
          </p>
        )}
      </div>
    );
  }
  function renderOptionCard(place: SavedPlace, index: number) {
    const experience = state.visits
      .filter((v) => v.savedPlaceId === place.id)
      .at(-1);
    return (
      <article className="option-card">
        <div className="art-wrap">
          <PlaceArt type={kind(place)} variant={index} />
          {place.sample && <span className="sample-art-badge">Sample</span>}
          <span className="option-number">0{index + 1}</span>
        </div>
        <div className="option-body">
          <div className="eyebrow">
            {place.category || "Saved place"}{" "}
            <span>· {place.neighborhood || place.city}</span>
          </div>
          <h3>{place.name}</h3>
          <p className="place-note">
            {place.whySaved || "Saved in your personal inspiration."}
          </p>
          <div className="match-line">
            <Bookmark size={13} />
            <span>
              {place.budgetEstimate === undefined
                ? "Price unknown"
                : `Your ${place.sample ? "sample " : ""}estimate: $${place.budgetEstimate}/person`}
            </span>
          </div>
          {experience && (
            <p className="memory-line">Your experience: “{experience.note}”</p>
          )}
          <div className="sources">
            {place.inspirationLinks.map((url, i) => (
              <a href={url} key={url} target="_blank" rel="noopener noreferrer">
                {sourceName(url)}
                {i > 0 ? ` ${i + 1}` : ""}
                <ExternalLink size={10} />
              </a>
            ))}
          </div>
          <div className="card-actions">
            <button
              onClick={() => choose(place)}
              disabled={processing || crossTab}
            >
              Choose this <ArrowUpRight size={14} />
            </button>
            <a
              href={mapsUrl(place, origin || state.settings.location)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {place.placeId ? "Open in Maps" : "Find in Maps"}
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </article>
    );
  }
  function renderMessage(message: Message) {
    const isLatestSchedule =
      message.kind === "schedule" &&
      state.messages.filter((m) => m.kind === "schedule").at(-1)?.id ===
        message.id;
    return (
      <div className={`message message-${message.role}`}>
        <div className="message-speaker">
          {message.role === "assistant" ? (
            <>
              <span className="tiny-pin">p</span> Pinny
            </>
          ) : (
            <>You</>
          )}
        </div>
        <p>{message.text}</p>
        {message.kind === "options" && (
          <div className="option-grid">
            {message.candidateIds?.map((id, index) => {
              const p = state.places.find((p) => p.id === id);
              return p ? (
                <div key={id} className="option-container">
                  {renderOptionCard(p, index)}
                </div>
              ) : (
                <p key={id} className="fine-print">
                  This saved place was removed.
                </p>
              );
            })}
          </div>
        )}
        {message.kind === "plan" &&
          state.messages.filter((m) => m.kind === "plan").at(-1)?.id ===
            message.id &&
          planPlaces.length > 0 &&
          renderPlanCard()}
        {isLatestSchedule && state.schedule && (
          <div className="schedule-card">
            <CalendarDays size={22} />
            <div>
              <strong>
                {scheduleLabel(state.schedule.start, state.schedule.timezone)}
              </strong>
              <p>
                {state.schedule.confirmed
                  ? "Confirmed · calendar file ready"
                  : "Waiting for your confirmation"}
              </p>
              <p>~{total} min of activities; allow extra time for travel.</p>
            </div>
            {state.schedule.confirmed ? (
              <button className="primary small" onClick={exportCalendar}>
                <Download size={15} /> Export .ics
              </button>
            ) : (
              <button
                className="primary small"
                disabled={processing}
                onClick={() => submit("Confirm this time.")}
              >
                <Check size={15} /> Confirm time
              </button>
            )}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Pinny home">
          <span className="brand-mark">
            <MapPin size={23} strokeWidth={2.5} />
          </span>
          pinny<span className="brand-dot">.</span>
        </Link>
        <div className="brand-tagline">From saved to someday soon.</div>
        <nav aria-label="Main navigation">
          <button
            className="nav-active"
            onClick={() => {
              closeDialog();
              inputRef.current?.focus();
            }}
          >
            <Compass size={19} /> Let’s go <span className="nav-dot" />
          </button>
          <button onClick={() => setInspirationOpen(true)}>
            <Bookmark size={18} /> Your inspiration{" "}
            <span className="nav-count">
              {ready ? state.places.length : "—"}
            </span>
          </button>
        </nav>
        <div className="sidebar-quote">
          <div className="quote-star">✳</div>
          <p>
            Good days start
            <br />
            with a little idea.
          </p>
          <span>
            You bring the mood.
            <br />
            I’ll help with the plan.
          </span>
        </div>
        <div className="sidebar-bottom">
          <div className="workspace-label">
            <span
              className={mode === "demo" ? "status-dot" : "status-dot green"}
            />
            {mode === "demo" ? "Sample workspace" : "Personal workspace"}
          </div>
          <p>
            {mode === "demo"
              ? "Illustrative notes & budgets. Real place names, unverified details."
              : "Only your saved inspiration. Stored on this device."}
          </p>
          <button
            className="mode-switch"
            onClick={switchMode}
            disabled={!ready || processing}
          >
            Switch to {mode === "demo" ? "my places" : "sample demo"}
            <ArrowUpRight size={14} />
          </button>
          <button
            className="quiet settings-link"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 size={14} /> Workspace settings
          </button>
          <div className="legal-links">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </aside>
      <main className="main-workspace">
        <header className="workspace-header">
          <div className="header-label">
            <span className="small-spark">
              <Sparkles size={15} />
            </span>
            Your personal outing companion
          </div>
          <button
            className="capability-badge"
            onClick={() => setSettingsOpen(true)}
            aria-label="Workspace settings and mode"
          >
            {mode === "demo" ? "Sample demo" : "Saved inspiration"}
            <span>·</span>No AI
          </button>
        </header>
        {(storageWarning || crossTab) && (
          <div className="warning" role="alert">
            {crossTab
              ? "This workspace changed in another tab. Reload it before continuing to avoid replacing those changes."
              : storageWarning}
            {crossTab && (
              <button
                onClick={() => {
                  const result = loadState(browserStorage(), mode);
                  setState(result.state);
                  latest.current = {
                    state: result.state,
                    mode,
                    writable: result.writable,
                  };
                  setWritable(result.writable);
                  setStorageWarning(result.warning || "");
                  setUndo(null);
                  conflict.current = false;
                  setCrossTab(false);
                }}
              >
                Reload saved data
              </button>
            )}
          </div>
        )}
        <div className="conversation-scroll" aria-label="Conversation">
          {!ready ? (
            <div className="loading-state">
              <span className="loading-dot" />
              Getting your inspiration ready…
            </div>
          ) : state.messages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-eyebrow">
                A LITTLE LESS SCROLLING. A LITTLE MORE LIVING.
              </div>
              <h1>
                What are you
                <br />
                in the <em>mood</em> for?
              </h1>
              <p className="welcome-description">
                That place you saved? Let’s actually go.
                <br />
                Tell me what sounds good. We’ll figure out the rest.
              </p>
              <div className="starter-prompts">
                <span>Try a little idea</span>
                {prompts.map((prompt, i) => (
                  <button
                    key={prompt}
                    onClick={() => submit(prompt)}
                    disabled={processing}
                  >
                    {i === 0 ? (
                      <Utensils size={15} />
                    ) : i === 1 ? (
                      <Footprints size={15} />
                    ) : (
                      <Coffee size={15} />
                    )}
                    <span>{prompt.replace(/\.$/, "")}</span>
                    <ArrowUpRight size={14} />
                  </button>
                ))}
              </div>
              <div className="saved-preview">
                <div className="section-line">
                  <span>A few things you’ve saved</span>
                  <button onClick={() => setInspirationOpen(true)}>
                    See inspiration <ArrowUpRight size={13} />
                  </button>
                </div>
                {state.places.length ? (
                  <div className="mini-places">
                    {state.places.slice(0, 3).map((place, i) => (
                      <button
                        key={place.id}
                        onClick={() => choose(place)}
                        className="mini-place"
                      >
                        <PlaceArt type={kind(place)} variant={i} />
                        <span>
                          <strong>{place.name}</strong>
                          <small>
                            {place.sample ? "Sample · " : ""}
                            {place.category}
                          </small>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    className="empty-inspiration"
                    onClick={() => draft("Save ")}
                  >
                    <Plus size={18} />
                    <span>
                      Start with a place you want to try.
                      <small>
                        Tell me its name, city, and what caught your eye.
                      </small>
                    </span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="conversation-intro">
                <span className="welcome-eyebrow">
                  LET’S MAKE A LITTLE PLAN
                </span>
                <h1>
                  Your kind of <em>outing.</em>
                </h1>
              </div>
              {state.messages.map((message) => (
                <div key={message.id}>{renderMessage(message)}</div>
              ))}
            </>
          )}
          {processing && (
            <div className="processing" role="status">
              <span className="tiny-pin">p</span>
              <span className="thinking-dots">
                <i />
                <i />
                <i />
              </span>
              <span>Organizing your saved ideas…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="composer-region">
          {planPlaces.length > 0 && (
            <details className="mobile-plan-summary">
              <summary>
                <MapPin size={14} />
                <span>
                  Your plan · {planPlaces.length} stops · ~{total} min + travel
                </span>
                <ChevronDown size={14} />
              </summary>
              <div>
                {renderPlanCard(true)}
                {state.schedule?.confirmed ? (
                  <button className="primary small" onClick={exportCalendar}>
                    <Download size={14} /> Export .ics
                  </button>
                ) : (
                  <button
                    className="secondary small"
                    onClick={() => draft("Make it tonight at six.")}
                  >
                    <CalendarDays size={14} /> Set a time
                  </button>
                )}
                <button className="quiet" onClick={() => draft("I went. ")}>
                  Tell Pinny how it went
                </button>
              </div>
            </details>
          )}
          <div
            className="interpreted-constraints"
            aria-label="Current interpreted context"
          >
            <MapPin size={12} />
            <button onClick={() => draft("Find something in ")}>
              {state.settings.location || "City not set"}
            </button>
            <span>·</span>
            <button onClick={() => draft("My budget is ")}>
              {state.settings.budget === null
                ? "Budget open"
                : `${state.context.budgetExclusive ? "Under " : ""}$${state.settings.budget}/person per stop`}
            </button>
            <span>·</span>
            <button
              onClick={() =>
                draft(
                  state.settings.context === "solo" ? "With friends" : "Alone",
                )
              }
            >
              {state.settings.context === "solo" ? "Solo" : "With others"}
            </button>
            <span>·</span>
            <button onClick={() => draft("I have ")}>
              {state.settings.availableTime} min of activities
            </button>
          </div>
          <form
            className={`composer ${voice === "listening" ? "composer-listening" : ""}`}
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <button
              type="button"
              className={`mic-button ${voice === "listening" ? "listening" : ""}`}
              onClick={startVoice}
              disabled={!ready || processing}
              aria-label={
                voice === "listening" ? "Stop listening" : "Start voice input"
              }
              aria-pressed={voice === "listening"}
            >
              {voice === "listening" ? (
                <Square size={23} fill="currentColor" />
              ) : voice === "unsupported" ? (
                <MicOff size={26} />
              ) : (
                <Mic size={27} />
              )}
            </button>
            <label className="sr-only" htmlFor="request">
              Tell Pinny what you want to do
            </label>
            <textarea
              id="request"
              ref={inputRef}
              rows={1}
              value={input}
              maxLength={2000}
              placeholder="Speak your mood, or type a little idea…"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  submit();
                }
              }}
              disabled={!ready || processing}
            />
            <button
              type="submit"
              className="send-button"
              aria-label="Send request"
              disabled={!ready || processing || !input.trim() || crossTab}
            >
              <ArrowUp size={21} />
            </button>
          </form>
          <div className="composer-caption" role="status">
            {voiceMessage ||
              (voice === "unsupported"
                ? "Voice is unavailable in this browser. Text always works."
                : voice === "listening"
                  ? "Listening… your transcription stays editable."
                  : "Tap to talk. Edit your words. Send when you’re ready.")}
            <span className="voice-hint">
              <Headphones size={12} />{" "}
              {voice === "listening"
                ? "Listening"
                : processing
                  ? "Processing"
                  : "Your pace, your plan"}
            </span>
          </div>
          <p className="honesty-caption">
            Matches your saved notes. Limited language parsing. No verified
            prices, hours, or reservations.
          </p>
        </div>
      </main>
      <aside className="outing-panel" aria-label="Current outing">
        <div className="panel-header">
          <div>
            <span className="eyebrow">FROM IDEA TO OUTING</span>
            <h2>A little plan</h2>
          </div>
          <span className="plan-icon">
            <MapPin size={18} />
          </span>
        </div>
        {planPlaces.length ? (
          <>
            <div className="outing-state">
              <span className="status-dot green" /> {planPlaces.length}{" "}
              {planPlaces.length === 1 ? "stop" : "stops"} · Your next little
              adventure
            </div>
            {renderPlanCard(true)}
            {state.schedule ? (
              <div className="panel-schedule">
                <CalendarDays size={17} />
                <div>
                  <strong>
                    {scheduleLabel(
                      state.schedule.start,
                      state.schedule.timezone,
                    )}
                  </strong>
                  <small>
                    {state.schedule.confirmed
                      ? "Confirmed"
                      : "Please confirm in the conversation"}
                  </small>
                </div>
              </div>
            ) : (
              <button
                className="plan-date-button"
                onClick={() => draft("Make it tonight at six.")}
              >
                <CalendarDays size={16} />
                Pick a day & time
                <Plus size={14} />
              </button>
            )}
            {state.schedule?.confirmed && (
              <button
                className="primary export-button"
                onClick={exportCalendar}
              >
                <Download size={16} /> Export calendar event
              </button>
            )}
            <p className="panel-disclaimer">
              Suggested activity time only. Travel is extra. Check destination
              matches and hours before you go.
            </p>
            <div className="experience-prompt">
              <div className="eyebrow">AFTER YOUR OUTING</div>
              <p>A little memory goes a long way.</p>
              <button onClick={() => draft("I went. ")}>
                Tell me how it went <ArrowUpRight size={14} />
              </button>
            </div>
          </>
        ) : (
          <div className="empty-plan">
            <EmptyPlanArt />
            <h3>Room for a good day.</h3>
            <p>
              Choose a place, add a little wander,
              <br />
              and your plan will land here.
            </p>
            <div className="plan-steps">
              <span>
                <i>1</i>Find your mood
              </span>
              <span>
                <i>2</i>Pick your places
              </span>
              <span>
                <i>3</i>Make a memory
              </span>
            </div>
          </div>
        )}
        {activeExperience && (
          <div className="personal-memory">
            <Bookmark size={15} />
            <span>
              Your memory of {activePlace?.name}
              <p>“{activeExperience.note}”</p>
            </span>
          </div>
        )}
        <div className="panel-footer">
          <span className="little-flower">✳</span> A plan, not a promise. Leave
          room for life.
        </div>
      </aside>
      {(notice || undo) && (
        <div className="toast" role="status">
          <Check size={16} />
          <span>{notice || "Updated on this device."}</span>
          {undo && (
            <button onClick={undoLast}>
              <Undo2 size={14} />
              Undo
            </button>
          )}
          <button
            className="icon-button"
            onClick={() => {
              setNotice("");
              setUndo(null);
            }}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      )}
      <dialog
        ref={dialogRef}
        className="workspace-dialog"
        aria-labelledby="dialog-title"
        onCancel={closeDialog}
      >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">
              {mode === "demo" ? "SAMPLE WORKSPACE" : "PERSONAL WORKSPACE"}
            </span>
            <h2 id="dialog-title">
              {resetOpen
                ? "Reset this workspace?"
                : settingsOpen
                  ? "Your workspace"
                  : "Your saved inspiration"}
            </h2>
          </div>
          <button
            className="icon-button"
            onClick={closeDialog}
            aria-label="Close dialog"
          >
            <X size={21} />
          </button>
        </div>
        {resetOpen ? (
          <>
            <p>
              This removes the places, plan, conversation, and experiences in
              this {mode === "demo" ? "sample" : "personal"} workspace.{" "}
              {mode === "demo"
                ? "Fresh sample places will be loaded."
                : "Your sample workspace is kept."}{" "}
              {writable
                ? "You can undo immediately afterward."
                : "Undo restores only the visible workspace; it cannot recover unreadable stored data after a reset."}
            </p>
            <div className="dialog-actions">
              <button className="secondary" onClick={closeDialog}>
                Keep my data
              </button>
              <button
                className="primary"
                onClick={() => {
                  const previous = state;
                  const next = mode === "demo" ? demoState() : emptyState();
                  setWritable(true);
                  latest.current = { state: previous, mode, writable: true };
                  commit(next);
                  setUndo(previous);
                  conflict.current = false;
                  setCrossTab(false);
                  closeDialog();
                  setNotice(
                    mode === "demo"
                      ? "Sample workspace reset."
                      : "Personal workspace cleared.",
                  );
                }}
              >
                Reset {mode === "demo" ? "demo" : "personal workspace"}
              </button>
            </div>
          </>
        ) : settingsOpen ? (
          <div className="settings-content">
            <button
              className="secondary"
              onClick={switchMode}
              disabled={processing}
            >
              Switch to {mode === "demo" ? "my places" : "sample demo"}
              <ArrowUpRight size={14} />
            </button>
            <p>
              Pinny uses your own saved notes and budget estimates. No AI is
              connected. Language understanding is limited to supported outing
              phrases and follow-ups.
            </p>
            <div className="setting-row">
              <span>
                <strong>Google place matching</strong>
                <small>
                  {google
                    ? "Configured · on demand only, confirmation required"
                    : "Not configured · navigation by name still works"}
                </small>
              </span>
              <span
                className={google ? "provider-status on" : "provider-status"}
              >
                {google ? "Available" : "Off"}
              </span>
            </div>
            <div className="setting-row">
              <span>
                <strong>Browser storage</strong>
                <small>
                  {writable
                    ? "Versioned local storage; no account or database"
                    : "Session only; existing unreadable data preserved"}
                </small>
              </span>
              <span className="provider-status">Local</span>
            </div>
            <button className="secondary" onClick={locate}>
              <MapPin size={15} /> Use my location for Maps
            </button>
            {locationStatus && (
              <p className="fine-print" role="status">
                {locationStatus}
              </p>
            )}
            <p className="fine-print">
              Your raw location is never saved. It only supplies a Maps starting
              point; recommendations use the city you tell Pinny.
            </p>
            {mode === "live" && (
              <div className="data-transfer">
                <h3>Move your Pinny data</h3>
                <p className="fine-print">Export your own places, experiences, and plan as JSON. Import merges them into this browser; it keeps an existing plan. This is not social-platform import or automatic sync.</p>
                <div className="transfer-actions">
                  <button className="secondary" onClick={exportPersonalData} disabled={processing}><Download size={15} /> Export JSON</button>
                  <button className="secondary" onClick={() => backupInput.current?.click()} disabled={processing || !writable || crossTab}>Import JSON</button>
                  <input ref={backupInput} type="file" accept=".json,application/json" hidden aria-label="Choose Pinny personal JSON backup" onChange={(event) => { void chooseBackup(event.target.files?.[0]); event.target.value = ""; }} />
                </div>
                {pendingBackup && <div className="import-preview">
                  <p>{pendingBackup.data.places.length} places · {pendingBackup.data.visits.length} experiences · {pendingBackup.data.plan.length} plan stops. Matching names and cities are merged; existing notes are kept.</p>
                  <button className="primary small" onClick={importPersonalData} disabled={processing || !writable || crossTab}>Confirm import</button>
                  <button className="quiet" onClick={() => setPendingBackup(null)}>Cancel</button>
                </div>}
                {transferStatus && <p className="fine-print" role="status">{transferStatus}</p>}
              </div>
            )}
            <div className="setting-row">
              <span>
                <strong>Start fresh</strong>
                <small>
                  Explicit reset only. Empty workspaces never auto-reseed.
                </small>
              </span>
              <button
                className="quiet danger"
                onClick={() => {
                  setSettingsOpen(false);
                  setResetOpen(true);
                }}
              >
                Reset {mode === "demo" ? "demo" : "workspace"}
              </button>
            </div>
            <div className="legal-links">
              <Link href="/privacy">Privacy policy</Link>
              <Link href="/terms">Terms of use</Link>
            </div>
          </div>
        ) : inspirationOpen ? (
          <>
            <p className="drawer-intro">
              Places you want to try, and the little reasons why.{" "}
              {mode === "demo"
                ? "All fixture notes, tags, budgets, and links below are sample references, not extracted posts."
                : ""}
            </p>
            <button
              className="primary add-inspiration"
              onClick={() => draft("Save ")}
            >
              <Plus size={17} />
              Tell Pinny about a place
            </button>
            <p className="fine-print">
              Try “Save The Mill in San Francisco for coffee, around $15” and
              add a source URL if you have one. Links are references; Pinny does
              not read posts.
            </p>
            <div className="inspiration-list">
              {state.places.length === 0 ? (
                <div className="drawer-empty">
                  <Bookmark size={30} />
                  <h3>A little inspiration starts here.</h3>
                  <p>No places saved yet. Tell Pinny a name and city.</p>
                </div>
              ) : (
                state.places.map((place) => (
                  <article key={place.id} className="saved-row">
                    <div className="saved-row-top">
                      <div>
                        <div className="eyebrow">
                          {place.sample ? "Sample · " : ""}
                          {place.category || "Saved place"} · {place.city}
                        </div>
                        <h3>{place.name}</h3>
                      </div>
                      <button
                        className="icon-button danger"
                        onClick={() => deletePlace(place)}
                        aria-label={`Delete ${place.name}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {noteEdit?.id === place.id ? (
                      <div className="note-editor">
                        <label htmlFor={`note-${place.id}`}>
                          Your reason for saving
                        </label>
                        <textarea
                          id={`note-${place.id}`}
                          maxLength={2000}
                          value={noteEdit.note}
                          onChange={(e) =>
                            setNoteEdit({ ...noteEdit, note: e.target.value })
                          }
                        />
                        <button
                          className="secondary small"
                          onClick={() => {
                            const next = structuredClone(state);
                            next.places = next.places.map((p) =>
                              p.id === place.id
                                ? { ...p, whySaved: noteEdit.note }
                                : p,
                            );
                            commit(next);
                            setNoteEdit(null);
                          }}
                        >
                          Save note
                        </button>
                      </div>
                    ) : (
                      <>
                        <p>{place.whySaved || "No personal note yet."}</p>
                        <button
                          className="quiet edit-note"
                          onClick={() =>
                            setNoteEdit({ id: place.id, note: place.whySaved })
                          }
                        >
                          Edit your note
                        </button>
                      </>
                    )}
                    <div className="sources">
                      {place.inspirationLinks.map((url, i) => (
                        <a
                          href={url}
                          key={url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {sourceName(url)}
                          {i > 0 ? ` ${i + 1}` : ""}
                          <ExternalLink size={11} />
                        </a>
                      ))}
                    </div>
                    <div className="saved-row-actions">
                      <button
                        className="secondary small"
                        onClick={() => {
                          closeDialog();
                          choose(place);
                        }}
                      >
                        Make a plan
                        <ArrowUpRight size={13} />
                      </button>
                      <a
                        href={mapsUrl(place, origin || state.settings.location)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {place.placeId ? "Open in Maps" : "Find in Maps"}
                        <ExternalLink size={12} />
                      </a>
                      {mode === "live" && (
                        <button
                          className="quiet"
                          onClick={() => searchGoogle(place)}
                        >
                          {place.placeId
                            ? "Refresh Google match"
                            : "Find Google match"}
                        </button>
                      )}
                    </div>
                    {state.visits
                      .filter((v) => v.savedPlaceId === place.id)
                      .map((v) => (
                        <div className="saved-experience" key={v.id}>
                          <strong>Your experience · {v.date}</strong>
                          <p>
                            “{v.note}”
                            {v.rating !== undefined
                              ? ` · Your existing rating: ${v.rating}/5`
                              : ""}
                          </p>
                        </div>
                      ))}
                    {googleSearch?.id === place.id && (
                      <div className="google-results">
                        {googleSearch.loading ? (
                          <p role="status">Searching Google Places…</p>
                        ) : googleSearch.error ? (
                          <>
                            <p role="alert">{googleSearch.error}</p>
                            <button
                              className="secondary small"
                              onClick={() => setGoogleSearch(null)}
                            >
                              Continue with saved inspiration
                            </button>
                            <button className="quiet" onClick={switchMode}>
                              Switch to sample demo
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="google-attribution">
                              Google Maps
                            </div>
                            <p className="fine-print">
                              Confirm the correct destination. Only its ID is
                              saved.
                            </p>
                            {googleSearch.candidates.length === 0 ? (
                              <p>
                                No candidates found. Keep this place unmatched.
                              </p>
                            ) : (
                              googleSearch.candidates.map((c) => (
                                <div className="google-candidate" key={c.id}>
                                  <strong>
                                    {c.displayName?.text || "Place candidate"}
                                  </strong>
                                  <p>{c.formattedAddress}</p>
                                  {c.attributions?.map((a, i) =>
                                    a.providerUri &&
                                    httpUrl.safeParse(a.providerUri).success ? (
                                      <a
                                        key={i}
                                        href={a.providerUri}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        {a.provider || "Data provider"}
                                      </a>
                                    ) : (
                                      <span key={i}>{a.provider}</span>
                                    ),
                                  )}
                                  <button
                                    className="secondary small"
                                    onClick={() => confirmGoogle(place, c)}
                                  >
                                    Confirm this match
                                  </button>
                                </div>
                              ))
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>
          </>
        ) : null}
      </dialog>
    </div>
  );
}
