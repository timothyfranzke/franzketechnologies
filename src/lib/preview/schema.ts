export type Vertical =
  | "food-hospitality"
  | "service-trade"
  | "professional-services"
  | "retail"
  | "generic";

export interface ReviewQuote {
  text: string;
  author?: string;
}

export interface ProspectSite {
  guid: string;
  name: string;
  city: string;
  state: string;
  category: string;
  vertical: Vertical;
  rating: number;
  reviewCount: number;
  phone?: string;
  address?: string;
  hours?: Record<string, string>;
  services: string[];
  reviewQuotes: ReviewQuote[];
  heroPhoto?: string;
  tagline?: string;
}
