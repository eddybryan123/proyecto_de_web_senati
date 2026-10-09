import Image from "next/image";
import Link from "next/link";
import { readRows } from "@/lib/db";
import type { MenuItem, PageComponent, SiteConfig } from "@/lib/types";

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function safeHref(value: unknown, fallback: string): string {
  const href = text(value);
  return /^(\/(?!\/)|#|https:\/\/|mailto:)/i.test(href) &&
    !/[\u0000-\u001f]/.test(href) &&
    !href.includes("\\")
    ? href
    : fallback;
}

async function getPublicSiteData() {
  const settings = await readRows<{ config_key: keyof SiteConfig; config_value: unknown }>(
    "SELECT config_key, config_value FROM site_config",
  );
  const config = Object.fromEntries(settings.map(({ config_key, config_value }) => [config_key, config_value])) as SiteConfig;
  const menu = await readRows<MenuItem>(
    "SELECT id, label, href, position, visible FROM menu_items WHERE visible = TRUE ORDER BY position",
  );
  return { config, menu };
}

export async function SiteRenderer({ components }: { components: PageComponent[] }) {
  const { config, menu } = await getPublicSiteData();
  return (
    <>
      <header className="site-header">
        <Link className="site-brand" href="/" aria-label={`${config.name}, inicio`}>
          {config.logoUrl ? <Image src={config.logoUrl} alt="" width={140} height={38} /> : <span className="brand-mark">{config.name.slice(0, 1)}</span>}
          <span>{config.name}</span>
        </Link>
        <nav aria-label="Navegación principal">
          {menu.map((item) => <a key={item.id} href={item.href}>{item.label}</a>)}
        </nav>
        <Link className="header-cta dashboard-cta" href="/admin/login">
          Dashboard <span aria-hidden="true">↗</span>
        </Link>
        <a className="header-cta" href="#contacto">Hablemos <span aria-hidden="true">↗</span></a>
      </header>
      <main>
        {components.map((component, index) => {
          const content = component.content;
          if (component.type === "hero") {
            return (
              <section className="hero-section content-width" key={component.id ?? index}>
                <div className="hero-copy">
                  <p className="eyebrow"><span />{text(content.eyebrow, "ESTUDIO DIGITAL INDEPENDIENTE")}</p>
                  <h1>{text(content.title, "Las buenas ideas merecen un gran comienzo.")}</h1>
                  <p className="hero-description">{text(content.body)}</p>
                  {text(content.buttonText) && (
                    <a className="button button-primary" href={safeHref(content.buttonHref, "#contacto")}>
                      {text(content.buttonText)} <span aria-hidden="true">↗</span>
                    </a>
                  )}
                  <div className="hero-proof"><span className="proof-stars">★★★★★</span> Diseñamos para lo que viene</div>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <div className="art-orbit orbit-one" />
                  <div className="art-orbit orbit-two" />
                  <div className="art-sun" />
                  <div className="art-card art-card-top"><span>✳</span> Make it meaningful</div>
                  <div className="art-card art-card-bottom"><span className="art-dot" /> Ideas in motion <b>↗</b></div>
                  <div className="art-caption">EST. FOR WHAT&apos;S NEXT <span>✳</span></div>
                </div>
              </section>
            );
          }
          if (component.type === "cards") {
            const items = Array.isArray(content.items) ? content.items as { title?: string; body?: string }[] : [];
            return (
              <section className="services-section" id="servicios" key={component.id ?? index}>
                <div className="content-width">
                  <div className="section-heading">
                    <p className="eyebrow"><span />{text(content.eyebrow, "LO QUE HACEMOS")}</p>
                    <h2>{text(content.title, "Pensado para avanzar.")}</h2>
                  </div>
                  <div className="service-grid">
                    {items.map((item, itemIndex) => (
                      <article className="service-card" key={`${item.title}-${itemIndex}`}>
                        <span className="service-number">0{itemIndex + 1}</span>
                        <h3>{item.title}</h3>
                        <p>{item.body}</p>
                        <span className="service-arrow" aria-hidden="true">↗</span>
                      </article>
                    ))}
                  </div>
                </div>
              </section>
            );
          }
          if (component.type === "text") {
            return (
              <section className="text-section content-width" key={component.id ?? index}>
                <p className="eyebrow"><span />{text(content.eyebrow, "NUESTRA FORMA DE VER")}</p>
                <h2>{text(content.title)}</h2>
                <p>{text(content.body)}</p>
              </section>
            );
          }
          return (
            <section className="cta-section content-width" id="contacto" key={component.id ?? index}>
              <div className="cta-card">
                <div className="cta-spark" aria-hidden="true">✳</div>
                <div>
                  <p className="eyebrow">EL SIGUIENTE PASO</p>
                  <h2>{text(content.title, "Tu próximo gran proyecto empieza aquí.")}</h2>
                  <p>{text(content.body, "Cuéntanos qué tienes en mente.")}</p>
                </div>
                <a className="button button-light" href={safeHref(content.buttonHref, "mailto:hola@nexo.studio")}>
                  {text(content.buttonText, "Escríbenos")} <span aria-hidden="true">↗</span>
                </a>
              </div>
            </section>
          );
        })}
      </main>
      <footer className="site-footer content-width">
        <Link className="site-brand" href="/"><span className="brand-mark">{config.name.slice(0, 1)}</span><span>{config.name}</span></Link>
        <p>{config.description}</p>
        <span>© {new Date().getFullYear()} {config.name}. Hecho con intención.</span>
      </footer>
    </>
  );
}
