import { ArrowRight, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { FadeIn } from "@/components/ui/motion-primitives";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import { FEATURED_COUNT, PROJECTS, type Project } from "@/lib/content/projects";
import { localePath, type Locale } from "@/lib/i18n";

export function Projects({
  locale,
  dict,
  featured = false,
}: {
  locale: Locale;
  dict: Dictionary;
  /** Home page shows the first four with a link through to the full list. */
  featured?: boolean;
}): ReactNode {
  const items = featured ? PROJECTS.slice(0, FEATURED_COUNT) : PROJECTS;

  return (
    <section className="relative w-full">
      <div className="mx-auto w-full max-w-275 px-6 sm:px-10">
        {featured ? (
          <FadeIn className="flex flex-col items-center gap-5 pt-12 pb-10 text-center sm:pt-20 sm:pb-14">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-accent">
              {dict.projects.eyebrow}
            </p>
            <h2 className="font-serif text-[2.5rem] font-medium leading-[1.05] text-foreground md:text-[3rem] lg:text-[3.5rem]">
              {dict.projects.headline}
            </h2>
            <p className="max-w-[38ch] text-[18px] leading-[1.45] text-muted-foreground sm:text-[20px]">
              {dict.projects.sub}
            </p>
          </FadeIn>
        ) : null}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-7">
          {items.map((project, index) => (
            <ProjectCard
              key={project.id}
              project={project}
              index={index}
              dict={dict}
            />
          ))}
        </div>

        {featured ? (
          <div className="mt-12 flex justify-center sm:mt-16">
            <Link
              href={localePath(locale, "/projects")}
              className="focus-ring group inline-flex cursor-pointer items-center gap-2 rounded-xl border border-foreground/10 bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-accent/40 hover:bg-accent/5"
            >
              {dict.projects.viewAll}
              <ArrowRight
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ProjectCard({
  project,
  index,
  dict,
}: {
  project: Project;
  index: number;
  dict: Dictionary;
}): ReactNode {
  const copy = dict.projects.items[project.id];

  return (
    <FadeIn delay={Math.min(index * 0.06, 0.3)}>
      <article className="project-card h-full rounded-3xl border border-foreground/10 bg-background p-3 sm:p-3.5">
        <Link
          href={project.href}
          target="_blank"
          rel="noopener noreferrer"
          className="focus-ring flex h-full flex-col gap-4 rounded-2xl"
        >
          <div
            className="project-card__image relative w-full overflow-hidden rounded-2xl bg-muted ring-1 ring-foreground/5"
            style={{ aspectRatio: project.ratio }}
          >
            <div className="project-card__image-inner">
              <Image
                src={project.image}
                alt={copy.title}
                fill
                sizes="(min-width: 1024px) 560px, (min-width: 768px) 45vw, 100vw"
                className="object-cover object-top"
                priority={index < 2}
              />
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-2.5 px-1">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-[20px] font-medium leading-[1.2] text-foreground sm:text-[22px]">
                {copy.title}
              </h3>
              <ArrowUpRight
                className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-accent rtl:-scale-x-100"
                aria-hidden="true"
              />
            </div>

            <p className="text-[14px] leading-normal text-muted-foreground sm:text-[15px]">
              {copy.description}
            </p>

            <ul className="mt-auto flex flex-wrap gap-1.5 pt-2">
              {project.frameworks.map((framework) => (
                <li
                  key={framework}
                  dir="ltr"
                  className="rounded-md border border-foreground/10 px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
                >
                  {framework}
                </li>
              ))}
            </ul>
          </div>

          <p className="px-1 pb-1 font-mono text-[12px] text-muted-foreground">
            {project.year}
            <span className="sr-only"> — {dict.projects.opensInNewTab}</span>
          </p>
        </Link>
      </article>
    </FadeIn>
  );
}
