export type SiteConfig = {
  name: string;
  description: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  foregroundColor: string;
  logoUrl: string;
  whatsappPhone: string;
};

export type Product = {
  id: number;
  name: string;
  description: string;
  priceCents: number;
  isActive: boolean;
};

export type MenuItem = {
  id: number;
  label: string;
  href: string;
  position: number;
  visible: boolean;
};

export type ComponentType = "hero" | "text" | "cards" | "cta";

export type PageComponent = {
  id?: number;
  type: ComponentType;
  content: Record<string, unknown>;
  position: number;
};

export type Page = {
  id: number;
  title: string;
  slug: string;
  status: "draft" | "published";
  updatedAt: string;
  components: PageComponent[];
};
