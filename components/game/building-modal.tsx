"use client";

import {
  Briefcase,
  Code2,
  ExternalLink,
  GraduationCap,
  Hammer,
  Heart,
  Newspaper,
  Sparkles,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { isRtl, type Locale } from "@/lib/i18n";
import type {
  BuildingPanel,
  EducationInfoItem,
  ExperienceInfoItem,
  InfoBuildingPanel,
  NewsBuildingPanel,
  NewsPanelItem,
  PortalBuildingPanel,
  StackInfoItem,
} from "@/lib/content/world.panels";
import { gameEvents } from "./engine/events";
import { ProgressPanelView } from "./progress-panel";

export type BuildingModalData = BuildingPanel;

const emptySubscribe = () => () => {};

function useIsMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

const PIXEL_FRAME =
  "0 -2px 0 0 #000, 0 2px 0 0 #000, -2px 0 0 0 #000, 2px 0 0 0 #000, -2px -2px 0 0 #000, 2px -2px 0 0 #000, -2px 2px 0 0 #000, 2px 2px 0 0 #000, inset 0 0 0 2px #d4a359, inset 0 0 0 4px #261f18";
const PIXEL_BTN =
  "0 -2px 0 0 #000, 0 2px 0 0 #000, -2px 0 0 0 #000, 2px 0 0 0 #000";
const PIXEL_BADGE =
  "0 -1px 0 0 #000, 0 1px 0 0 #000, -1px 0 0 0 #000, 1px 0 0 0 #000";
const PIXEL_CARD =
  "0 -1px 0 0 #000, 0 1px 0 0 #000, -1px 0 0 0 #000, 1px 0 0 0 #000, inset 0 0 0 1px rgba(255,255,255,0.08)";
const PIXEL_PRIMARY_BTN =
  "0 -2px 0 0 #000, 0 2px 0 0 #000, -2px 0 0 0 #000, 2px 0 0 0 #000, inset 0 0 0 2px rgba(255,255,255,0.2)";

export function BuildingModal({
  building,
  onClose,
  dict,
  locale,
}: {
  building: BuildingPanel | null;
  onClose: () => void;
  dict: Dictionary;
  locale: Locale;
}): ReactNode {
  const rtl = isRtl(locale);
  const mounted = useIsMounted();
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const handleClose = useCallback(() => {
    gameEvents.unlockUi("building");
    onClose();
  }, [onClose]);

  // Lock UI while building modal is active, unlock on close
  useEffect(() => {
    if (!building) return;
    gameEvents.lockUi("building");
    return () => {
      gameEvents.unlockUi("building");
    };
  }, [building]);

  // Focus preservation and initial focus on modal open
  useEffect(() => {
    if (!building) return;

    previousActiveElement.current =
      document.activeElement as HTMLElement | null;

    const timer = setTimeout(() => {
      const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable && focusable.length > 0) {
        focusable[0]?.focus();
      }
    }, 20);

    return () => {
      clearTimeout(timer);
      previousActiveElement.current?.focus?.();
    };
  }, [building]);

  // Focus trap & Escape listener
  useEffect(() => {
    if (!building) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
        return;
      }

      if (e.key === "Tab") {
        const focusables = modalRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [building, handleClose]);

  if (!building || !mounted || typeof document === "undefined") return null;

  const modalMarkup = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="building-modal-title"
      dir={rtl ? "rtl" : "ltr"}
      className="animate-in fade-in fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm duration-150 select-none motion-reduce:animate-none sm:p-4"
    >
      <div
        ref={modalRef}
        style={{
          boxShadow: PIXEL_FRAME,
          imageRendering: "pixelated",
        }}
        className="bg-background relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col rounded-none p-3.5 shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] sm:p-5"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          aria-label={dict.play.buildingPanels.close}
          style={{
            boxShadow: PIXEL_BTN,
            imageRendering: "pixelated",
          }}
          className="focus-ring bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground absolute end-3 top-3 z-10 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-none transition-colors sm:h-8 sm:w-8"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <HeaderSection building={building} dict={dict} />

        {/* Modal Content Scroll Area */}
        <div className="custom-scroll my-2 min-h-0 flex-1 overflow-y-auto pe-1 text-sm sm:text-base">
          {building.kind === "info" && (
            <InfoPanelView panel={building} dict={dict} />
          )}
          {building.kind === "news" && (
            <NewsPanelView panel={building} dict={dict} />
          )}
          {building.kind === "portal" && (
            <PortalPanelView panel={building} dict={dict} />
          )}
          {building.kind === "progress" && (
            <ProgressPanelView panel={building} dict={dict} />
          )}
        </div>

        {/* Pinned Non-Scrolling Footer */}
        <div className="border-foreground/10 flex shrink-0 flex-wrap items-center justify-between gap-2 border-t pt-3">
          <button
            type="button"
            onClick={handleClose}
            style={{
              boxShadow: PIXEL_BTN,
              imageRendering: "pixelated",
            }}
            className="focus-ring bg-muted text-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer rounded-none px-3.5 py-2 text-xs font-semibold tracking-wide transition-colors sm:px-4 sm:text-sm"
          >
            {dict.play.buildingPanels.close}
          </button>

          {building.kind === "portal" && (
            <div className="flex flex-wrap items-center gap-2">
              {building.project.repoUrl && (
                <a
                  href={building.project.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    boxShadow: PIXEL_BTN,
                    imageRendering: "pixelated",
                  }}
                  className="focus-ring bg-muted text-foreground hover:bg-muted/80 inline-flex cursor-pointer items-center gap-1.5 rounded-none px-3 py-2 text-xs font-semibold transition-colors sm:text-sm"
                >
                  <span>{dict.play.buildingPanels.viewSource}</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}

              {building.project.liveUrl && (
                <a
                  href={building.project.liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    boxShadow: PIXEL_PRIMARY_BTN,
                    imageRendering: "pixelated",
                  }}
                  className="focus-ring bg-accent text-accent-foreground inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-none px-3.5 py-2 text-xs font-bold tracking-wide transition-opacity hover:opacity-90 active:translate-y-0.5 sm:px-4 sm:text-sm"
                >
                  <span>{dict.play.buildingPanels.visitLiveSite}</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalMarkup, document.body);
}

/* ----------------------------------------------------------------- header */

function HeaderSection({
  building,
  dict,
}: {
  building: BuildingPanel;
  dict: Dictionary;
}): ReactNode {
  const getBadgeText = (): string => {
    if (building.kind === "portal") {
      return dict.play.buildingPanels.portal;
    }
    if (building.kind === "news") {
      return dict.play.buildingPanels.news;
    }
    if (building.kind === "progress") {
      return dict.play.buildingPanels.inProgress;
    }
    switch (building.section) {
      case "education":
        return dict.play.buildingPanels.education;
      case "experience":
        return dict.play.buildingPanels.experience;
      case "stack":
        return dict.play.buildingPanels.stack;
      case "hobbies":
        return dict.play.buildingPanels.hobbies;
      case "family":
        return dict.play.buildingPanels.family;
      default:
        return dict.play.buildingStatus;
    }
  };

  const renderIcon = (): ReactNode => {
    if (building.kind === "portal") {
      return <ExternalLink className="h-5 w-5 stroke-[2.2] sm:h-6 sm:w-6" />;
    }
    if (building.kind === "news") {
      return <Newspaper className="h-5 w-5 stroke-[2.2] sm:h-6 sm:w-6" />;
    }
    if (building.kind === "progress") {
      return <Hammer className="h-5 w-5 stroke-[2.2] sm:h-6 sm:w-6" />;
    }
    switch (building.section) {
      case "education":
        return <GraduationCap className="h-5 w-5 stroke-[2.2] sm:h-6 sm:w-6" />;
      case "experience":
        return <Briefcase className="h-5 w-5 stroke-[2.2] sm:h-6 sm:w-6" />;
      case "stack":
        return <Code2 className="h-5 w-5 stroke-[2.2] sm:h-6 sm:w-6" />;
      case "hobbies":
        return <Sparkles className="h-5 w-5 stroke-[2.2] sm:h-6 sm:w-6" />;
      case "family":
        return <Heart className="h-5 w-5 stroke-[2.2] sm:h-6 sm:w-6" />;
      default:
        return <Briefcase className="h-5 w-5 stroke-[2.2] sm:h-6 sm:w-6" />;
    }
  };

  const title =
    building.kind === "portal" ? building.project.title : building.title;

  return (
    <div className="mb-2.5 flex shrink-0 items-start gap-2.5 pe-9 sm:gap-3.5 sm:pe-10">
      <div
        style={{
          boxShadow:
            "0 -2px 0 0 #000, 0 2px 0 0 #000, -2px 0 0 0 #000, 2px 0 0 0 #000, inset 0 0 0 2px #d4a359",
          imageRendering: "pixelated",
        }}
        className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-none text-[#ab4c24] sm:h-12 sm:w-12"
      >
        {renderIcon()}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <h2
            id="building-modal-title"
            className="text-foreground truncate text-base font-bold sm:text-lg"
          >
            {title}
          </h2>
          <span
            style={{ boxShadow: PIXEL_BADGE }}
            className="bg-accent/20 text-accent px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider uppercase sm:text-[10px]"
          >
            {getBadgeText()}
          </span>
        </div>
        {building.sign && (
          <span className="text-muted-foreground line-clamp-1 font-mono text-[11px] sm:text-xs">
            {building.sign}
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- info panel */

function InfoPanelView({
  panel,
  dict,
}: {
  panel: InfoBuildingPanel;
  dict: Dictionary;
}): ReactNode {
  const isDev = process.env.NODE_ENV !== "production";

  if (panel.section === "education") {
    const eduItems = panel.items as EducationInfoItem[];
    return (
      <div className="space-y-2">
        {eduItems.map((item) => (
          <div
            key={item.id}
            style={{ boxShadow: PIXEL_CARD }}
            className="bg-muted/40 hover:bg-muted/60 rounded-none p-2.5 transition-colors sm:p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-1.5">
              <div className="min-w-0 flex-1">
                <span className="text-foreground block text-xs font-semibold sm:text-sm">
                  {item.qualification}
                </span>
                <span className="text-muted-foreground block text-[11px] sm:text-xs">
                  {item.school}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {item.period && (
                  <span className="text-muted-foreground font-mono text-[10px] sm:text-[11px]">
                    {item.period}
                  </span>
                )}
                <span
                  style={{ boxShadow: PIXEL_BADGE }}
                  className={`px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase ${
                    item.degreeType === "degree"
                      ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                      : "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                  }`}
                >
                  {item.badge ??
                    (item.degreeType === "degree"
                      ? dict.play.buildingPanels.degree
                      : dict.play.buildingPanels.certificate)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (panel.section === "experience") {
    const expItems = panel.items as ExperienceInfoItem[];
    return (
      <div className="space-y-2">
        {expItems.map((item) => (
          <div
            key={item.id}
            style={{ boxShadow: PIXEL_CARD }}
            className="bg-muted/40 hover:bg-muted/60 rounded-none p-2.5 transition-colors sm:p-3"
          >
            <div className="flex items-start gap-2.5 sm:gap-3">
              <div
                style={{
                  backgroundColor: item.brand,
                  boxShadow: PIXEL_BADGE,
                }}
                className="flex h-7 w-7 shrink-0 items-center justify-center font-mono text-xs font-bold text-white uppercase shadow-sm sm:h-8 sm:w-8"
              >
                {item.org.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-1">
                  <span className="text-foreground text-xs font-bold sm:text-sm">
                    {item.role}
                  </span>
                  {item.period && (
                    <span className="text-muted-foreground font-mono text-[10px] sm:text-[11px]">
                      {item.period}
                    </span>
                  )}
                </div>
                <span className="text-muted-foreground block text-[11px] sm:text-xs">
                  {item.org}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (panel.section === "stack") {
    const stackItems = panel.items as StackInfoItem[];
    const techChips = stackItems.filter((i) => i.category === "technology");
    const skillChips = stackItems.filter((i) => i.category === "skill");

    return (
      <div className="space-y-3.5 sm:space-y-4">
        {/* Technologies Grid */}
        <div>
          <span className="text-muted-foreground mb-1.5 block font-mono text-[11px] font-semibold tracking-wider uppercase">
            {dict.aboutPage.stackHeading}
          </span>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {techChips.map((chip) => (
              <div
                key={chip.id}
                style={{
                  boxShadow: PIXEL_CARD,
                  backgroundColor: chip.bg ? `${chip.bg}22` : undefined,
                }}
                className="bg-muted/50 inline-flex items-center gap-1.5 px-2 py-0.5 text-xs sm:px-2.5 sm:py-1"
              >
                {chip.icon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={chip.icon}
                    alt={chip.title}
                    className="h-3 w-3 shrink-0 object-contain sm:h-3.5 sm:w-3.5"
                  />
                )}
                <span className="text-foreground text-[11px] font-medium sm:text-xs">
                  {chip.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Core Skills & Specialisms */}
        <div>
          <span className="text-muted-foreground mb-1.5 block font-mono text-[11px] font-semibold tracking-wider uppercase">
            {dict.play.buildingPanels.coreSkills}
          </span>
          <div className="flex flex-wrap gap-1">
            {skillChips.map((skill) => (
              <span
                key={skill.id}
                style={{ boxShadow: PIXEL_BADGE }}
                className="bg-muted text-muted-foreground px-1.5 py-0.5 font-mono text-[10px] sm:text-[11px]"
              >
                {skill.title}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Hobbies or Family section (renders cards with demo tag in dev mode)
  return (
    <div className="space-y-2">
      {panel.items.map((item) => (
        <div
          key={item.id}
          style={{ boxShadow: PIXEL_CARD }}
          className="bg-muted/40 rounded-none p-2.5 sm:p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-foreground text-xs font-semibold sm:text-sm">
              {item.title}
            </span>
            {item.demo && isDev && (
              <span
                style={{ boxShadow: PIXEL_BADGE }}
                className="py-0.2 border border-amber-500/30 bg-amber-500/20 px-1 font-mono text-[9px] font-bold text-amber-600 uppercase dark:text-amber-400"
              >
                {dict.play.buildingPanels.demoTag}
              </span>
            )}
          </div>
          {item.subtitle && (
            <span className="text-accent block font-mono text-[11px]">
              {item.subtitle}
            </span>
          )}
          {item.description && (
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              {item.description}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- news panel */

function NewsPanelView({
  panel,
  dict,
}: {
  panel: NewsBuildingPanel;
  dict: Dictionary;
}): ReactNode {
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div className="space-y-2.5">
      {panel.items.map((item: NewsPanelItem) => (
        <div
          key={item.id}
          style={{ boxShadow: PIXEL_CARD }}
          className="bg-muted/40 hover:bg-muted/60 rounded-none p-3 transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-accent font-mono text-[11px] font-semibold sm:text-xs">
              {item.date}
            </span>
            <div className="flex items-center gap-1.5">
              <span
                style={{ boxShadow: PIXEL_BADGE }}
                className="bg-accent/20 text-accent px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase"
              >
                {dict.play.buildingPanels.latestDispatch}
              </span>
              {item.demo && isDev && (
                <span
                  style={{ boxShadow: PIXEL_BADGE }}
                  className="py-0.2 border border-amber-500/30 bg-amber-500/20 px-1 font-mono text-[9px] font-bold text-amber-600 uppercase dark:text-amber-400"
                >
                  {dict.play.buildingPanels.demoTag}
                </span>
              )}
            </div>
          </div>
          <h3 className="text-foreground mt-1 text-xs font-bold sm:text-sm">
            {item.title}
          </h3>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            {item.body}
          </p>
          {item.href && (
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent mt-1.5 inline-flex items-center gap-1 text-xs font-semibold hover:underline"
            >
              <span>{dict.projects.visit}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------- portal panel */

function PortalPanelView({
  panel,
  dict,
}: {
  panel: PortalBuildingPanel;
  dict: Dictionary;
}): ReactNode {
  const { project } = panel;

  return (
    <div className="space-y-3">
      {/* Capped Screenshot Height: max-h-[30vh] on mobile/short screens so summary is visible */}
      {project.image && (
        <div
          style={{
            boxShadow:
              "0 -2px 0 0 #000, 0 2px 0 0 #000, -2px 0 0 0 #000, 2px 0 0 0 #000",
            imageRendering: "pixelated",
          }}
          className="bg-muted overflow-hidden"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={project.image}
            alt={project.title}
            className="aspect-video max-h-[25vh] w-full object-cover sm:max-h-[32vh]"
          />
        </div>
      )}

      {/* Summary */}
      <p className="text-foreground/90 text-xs leading-relaxed sm:text-sm">
        {project.summary}
      </p>

      {/* Tech Chips & Year */}
      <div className="flex flex-wrap items-center gap-1.5">
        {project.tech.map((t) => (
          <span
            key={t}
            style={{ boxShadow: PIXEL_BADGE }}
            className="bg-muted text-muted-foreground px-2 py-0.5 font-mono text-[10px] font-medium"
          >
            {t}
          </span>
        ))}
        {project.year && (
          <span
            style={{ boxShadow: PIXEL_BADGE }}
            className="bg-accent/20 text-accent px-2 py-0.5 font-mono text-[10px] font-bold"
          >
            {project.year}
          </span>
        )}
      </div>

      <span className="text-muted-foreground block font-mono text-[10px]">
        {dict.play.buildingPanels.newTab}
      </span>
    </div>
  );
}
