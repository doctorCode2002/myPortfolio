/**
 * Locale-neutral testimonial and student-review data. Names, roles and quotes
 * are prose and live in the dictionaries keyed by `id`; only the ordering,
 * rating and identity live here.
 */

export type TestimonialId =
  | "ahmad"
  | "sara"
  | "saleh"
  | "omar"
  | "eyad";

export type Testimonial = {
  id: TestimonialId;
  rating: number;
};

export const TESTIMONIALS: readonly Testimonial[] = [
  { id: "ahmad", rating: 5 },
  { id: "sara", rating: 4 },
  { id: "saleh", rating: 5 },
  { id: "omar", rating: 5 },
  { id: "eyad", rating: 5 },
] as const;

export type StudentReviewId =
  | "nour"
  | "shahd"
  | "tayma"
  | "saja"
  | "tasneemM"
  | "tasneemB"
  | "nourAldin";

export type StudentReview = {
  id: StudentReviewId;
  rating: number;
};

export const STUDENT_REVIEWS: readonly StudentReview[] = [
  { id: "nour", rating: 5 },
  { id: "shahd", rating: 5 },
  { id: "tayma", rating: 5 },
  { id: "saja", rating: 5 },
  { id: "tasneemM", rating: 5 },
  { id: "tasneemB", rating: 5 },
  { id: "nourAldin", rating: 5 },
] as const;

/** Mentoring headline figures. Values are locale-neutral; labels are in the dictionaries. */
export type MentorStatId = "hours" | "reviews" | "ai";

export const MENTOR_STATS: readonly { id: MentorStatId; value: string }[] = [
  { id: "hours", value: "40h" },
  { id: "reviews", value: "1:1" },
  { id: "ai", value: "AI" },
] as const;

export const MENTOR_POINT_IDS = [
  "curriculum",
  "projects",
  "reviews",
  "ai",
] as const;

export type MentorPointId = (typeof MENTOR_POINT_IDS)[number];
