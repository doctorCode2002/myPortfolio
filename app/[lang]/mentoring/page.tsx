import type { Metadata } from "next";
import type { ReactNode } from "react";

import { getDictionary } from "../dictionaries";
import { ContactCard } from "@/components/contact/contact-card";
import { MentorProfile } from "@/components/mentoring/mentor-profile";
import { StudentReviews } from "@/components/mentoring/student-reviews";
import { isLocale, type Locale } from "@/lib/i18n";
import { createMetadata } from "@/lib/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale: Locale = isLocale(lang) ? lang : "en";
  const dict = await getDictionary(locale);

  return createMetadata({
    locale,
    path: "/mentoring",
    title: dict.meta.mentoring.title,
    description: dict.meta.mentoring.description,
    siteName: dict.meta.siteName,
  });
}

export default async function MentoringPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<ReactNode> {
  const { lang } = await params;
  const locale: Locale = isLocale(lang) ? lang : "en";
  const dict = await getDictionary(locale);

  return (
    <main id="main-content" className="flex flex-1 flex-col">
      <MentorProfile dict={dict} />
      <StudentReviews dict={dict} />
      <ContactCard locale={locale} dict={dict} />
      <div className="h-12 sm:h-16" />
    </main>
  );
}
