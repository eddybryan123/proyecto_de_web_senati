"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/client-api";
import { ProductManager } from "@/components/product-manager";
import type { ComponentType, MenuItem, Page, PageComponent, SiteConfig } from "@/lib/types";

type Section = "home" | "pages" | "products" | "appearance" | "menu";
type Session = { email: string; role: string };

const sectionLabels: Record<Section, string> = {
  home: "Resumen",
  pages: "Páginas",
  products: "Productos",
  appearance: "Apariencia",
  menu: "Menú",
};
const componentLabels: Record<ComponentType, string> = {
  hero: "Portada",
  text: "Texto",
  cards: "Tarjetas",
  cta: "Llamado a la acción",
};
const blankConfig: SiteConfig = {
  name: "", description: "", primaryColor: "#6759E8", accentColor: "#C8F169",
  backgroundColor: "#F7F7FB", foregroundColor: "#191827", logoUrl: "",
  whatsappPhone: "",
};

function defaultBlock(type: ComponentType, position: number): PageComponent {
  const content: Record<ComponentType, Record<string, unknown>> = {
    hero: { eyebrow: "UNA NUEVA HISTORIA", title: "Escribe un gran titular.", body: "Presenta tu idea en pocas palabras.", buttonText: "Conoce más", buttonHref: "#contacto" },
    text: { eyebrow: "NUESTRA HISTORIA", title: "Un título para tu sección.", body: "Comparte aquí los detalles de tu historia." },
    cards: { eyebrow: "LO QUE HACEMOS", title: "Nuestros servicios.", items: [{ title: "Servicio nuevo", body: "Describe brevemente este servicio." }] },
    cta: { title: "Hablemos de tu próximo proyecto.", body: "Estamos listos para escucharte.", buttonText: "Escríbenos", buttonHref: "mailto:hola@ejemplo.com" },
  };
  return { type, content: content[type], position };
}

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function AdminDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [section, setSection] = useState<Section>("home");
  const [config, setConfig] = useState<SiteConfig>(blankConfig);
  const [pages, setPages] = useState<Page[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadWorkspace = useCallback(async () => {
    const currentSession = await fetchJson<Session>("/api/auth/session");
    const [siteConfig, sitePages, menuItems] = await Promise.all([
      fetchJson<SiteConfig>("/api/site-config"),
      fetchJson<Page[]>("/api/pages"),
      fetchJson<MenuItem[]>("/api/menu"),
    ]);
    setSession(currentSession);
    setConfig(siteConfig);
    setPages(sitePages);
    setMenu(menuItems);
  }, []);

  useEffect(() => {
    let mounted = true;
    const timer = window.setTimeout(() => {
      loadWorkspace()
        .catch((cause: unknown) => {
          if (cause instanceof Error && cause.message.includes("sesión")) {
            router.replace("/admin/login");
            return;
          }
          if (mounted) setError(cause instanceof Error ? cause.message : "No se pudo cargar el panel.");
        })
        .finally(() => { if (mounted) setLoading(false); });
    }, 0);
    return () => { mounted = false; window.clearTimeout(timer); };
  }, [loadWorkspace, router]);

  async function signOut() {
    await fetchJson("/api/auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  function showNotice(message: string) {
    setNotice(message);
    setError("");
    window.setTimeout(() => setNotice(""), 3500);
  }

  async function saveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const updated = await fetchJson<SiteConfig>("/api/site-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      setConfig({ ...config, ...updated });
      showNotice("Los cambios de identidad se guardaron.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la configuración.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await fetchJson<{ src: string }>("/api/media", { method: "POST", body: formData });
      setConfig((current) => ({ ...current, logoUrl: result.src }));
      showNotice("Logo optimizado. Guarda los cambios para publicarlo.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo procesar el logo.");
    } finally {
      setBusy(false);
    }
  }

  async function saveMenu() {
    setBusy(true);
    setError("");
    try {
      await fetchJson("/api/menu", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(menu),
      });
      showNotice("El menú se actualizó correctamente.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el menú.");
    } finally {
      setBusy(false);
    }
  }

  async function createPage() {
    const title = window.prompt("¿Cómo se llamará la nueva página?");
    if (!title?.trim()) return;
    setBusy(true);
    setError("");
    try {
      const created = await fetchJson<Page>("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      setPages((current) => [created, ...current]);
      setPage(created);
      setSection("pages");
      showNotice("Página creada como borrador. Añade bloques y publícala cuando esté lista.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear la página.");
    } finally {
      setBusy(false);
    }
  }

  async function openPage(item: Page) {
    setBusy(true);
    setError("");
    try {
      const selected = await fetchJson<Page>(`/api/pages/${item.id}`);
      setPage(selected);
      setSection("pages");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo abrir la página.");
    } finally {
      setBusy(false);
    }
  }

  async function savePage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!page) return;
    setBusy(true);
    setError("");
    try {
      const saved = await fetchJson<Page>(`/api/pages/${page.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(page),
      });
      setPage(saved);
      setPages((current) => current.map((item) => item.id === saved.id ? saved : item));
      showNotice(saved.status === "published" ? "La página ya está publicada." : "El borrador se guardó.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la página.");
    } finally {
      setBusy(false);
    }
  }

  async function deletePage() {
    if (!page || !window.confirm(`¿Eliminar “${page.title}” y todos sus bloques?`)) return;
    setBusy(true);
    setError("");
    try {
      await fetchJson(`/api/pages/${page.id}`, { method: "DELETE" });
      setPages((current) => current.filter((item) => item.id !== page.id));
      setPage(null);
      showNotice("La página se eliminó.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo eliminar la página.");
    } finally {
      setBusy(false);
    }
  }

  function updatePage(patch: Partial<Page>) {
    setPage((current) => current ? { ...current, ...patch } : current);
  }

  function updateBlock(index: number, patch: Partial<PageComponent>) {
    setPage((current) => current ? {
      ...current,
      components: current.components.map((block, blockIndex) => blockIndex === index ? { ...block, ...patch } : block),
    } : current);
  }

  function changeBlockField(index: number, key: string, value: string) {
    const block = page?.components[index];
    if (!block) return;
    updateBlock(index, { content: { ...block.content, [key]: value } });
  }

  function moveBlock(index: number, direction: -1 | 1) {
    if (!page) return;
    const components = [...page.components];
    const target = index + direction;
    if (target < 0 || target >= components.length) return;
    [components[index], components[target]] = [components[target], components[index]];
    updatePage({ components: components.map((block, position) => ({ ...block, position })) });
  }

  function moveMenuItem(index: number, direction: -1 | 1) {
    setMenu((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const updated = [...current];
      [updated[index], updated[target]] = [updated[target], updated[index]];
      return updated.map((item, position) => ({ ...item, position }));
    });
  }

  function renderBlockFields(block: PageComponent, index: number) {
    const keys = block.type === "hero"
      ? [["eyebrow", "Antetítulo"], ["title", "Título"], ["body", "Descripción"], ["buttonText", "Texto del botón"], ["buttonHref", "Enlace del botón"]]
      : block.type === "cta"
        ? [["title", "Título"], ["body", "Descripción"], ["buttonText", "Texto del botón"], ["buttonHref", "Enlace del botón"]]
        : block.type === "text"
          ? [["eyebrow", "Antetítulo"], ["title", "Título"], ["body", "Texto"]]
          : [["eyebrow", "Antetítulo"], ["title", "Título"]];
    const cardItems = Array.isArray(block.content.items) ? block.content.items as { title?: string; body?: string }[] : [];
    return (
      <div className="block-fields">
        {keys.map(([key, label]) => (
          <div className={`form-field ${key === "body" || key === "title" ? "wide-field" : ""}`} key={key}>
            <label htmlFor={`block-${index}-${key}`}>{label}</label>
            {key === "body" ? (
              <textarea id={`block-${index}-${key}`} value={toText(block.content[key])} onChange={(event) => changeBlockField(index, key, event.target.value)} />
            ) : (
              <input id={`block-${index}-${key}`} value={toText(block.content[key])} onChange={(event) => changeBlockField(index, key, event.target.value)} />
            )}
          </div>
        ))}
        {block.type === "cards" && (
          <div className="wide-field">
            <span className="field-label">Tarjetas</span>
            <div className="setting-form" style={{ marginTop: 10 }}>
              {cardItems.map((item, cardIndex) => (
                <div className="card-item-fields" key={cardIndex}>
                  <input aria-label={`Título de tarjeta ${cardIndex + 1}`} value={item.title ?? ""} placeholder="Título" onChange={(event) => {
                    const items = [...cardItems];
                    items[cardIndex] = { ...items[cardIndex], title: event.target.value };
                    const current = page?.components[index];
                    if (current) updateBlock(index, { content: { ...current.content, items } });
                  }} />
                  <input aria-label={`Descripción de tarjeta ${cardIndex + 1}`} value={item.body ?? ""} placeholder="Descripción" onChange={(event) => {
                    const items = [...cardItems];
                    items[cardIndex] = { ...items[cardIndex], body: event.target.value };
                    const current = page?.components[index];
                    if (current) updateBlock(index, { content: { ...current.content, items } });
                  }} />
                  <button className="danger-action" type="button" aria-label="Eliminar tarjeta" onClick={() => {
                    const items = cardItems.filter((_, itemIndex) => itemIndex !== cardIndex);
                    const current = page?.components[index];
                    if (current) updateBlock(index, { content: { ...current.content, items } });
                  }}>×</button>
                </div>
              ))}
              <button className="secondary-action" type="button" onClick={() => {
                const current = page?.components[index];
                if (current) updateBlock(index, { content: { ...current.content, items: [...cardItems, { title: "Nueva tarjeta", body: "" }] } });
              }}>+ Añadir tarjeta</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (loading) return <div className="loading-screen">Preparando tu espacio de trabajo...</div>;

  return (
    <div className="admin-shell" style={{
      "--color-primary": config.primaryColor,
      "--color-accent": config.accentColor,
      "--color-site-bg": config.backgroundColor,
      "--color-site-fg": config.foregroundColor,
    } as React.CSSProperties}>
      <aside className="admin-sidebar">
        <Link className="site-brand" href="/"><span className="brand-mark">{config.name.slice(0, 1) || "N"}</span><span>{config.name || "Nexo"}</span></Link>
        <p className="workspace-label">ESPACIO DE TRABAJO</p>
        <nav className="admin-nav" aria-label="Administración">
          {([
            ["home", "⌂", "Resumen"],
            ["pages", "▤", "Páginas"],
            ["products", "◈", "Productos"],
            ["appearance", "◉", "Apariencia"],
            ["menu", "☷", "Menú"],
          ] as [Section, string, string][]).map(([key, icon, label]) => (
            <button className={section === key ? "active" : ""} type="button" key={key} onClick={() => { setSection(key); if (key !== "pages") setPage(null); }}>
              <span className="nav-icon">{icon}</span>{label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="admin-user"><span className="user-avatar">{session?.email.slice(0, 1).toUpperCase() ?? "A"}</span><div className="user-info"><strong>{session?.email}</strong><span>Administrador</span></div></div>
          <button className="logout-button" type="button" onClick={signOut}>↪ Cerrar sesión</button>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar"><span className="breadcrumb">Mi sitio <span aria-hidden="true">/</span> <strong>{page ? "Editar página" : sectionLabels[section]}</strong></span><a className="preview-link" href="/" target="_blank" rel="noreferrer">Ver sitio ↗</a></header>
        <main className="admin-content">
          {error && <p className="error-message" role="alert">{error}</p>}
          {notice && <p className="success-message" role="status">{notice}</p>}
          {section === "home" && (
            <>
              <div className="admin-heading"><div><h1>Hola, {session?.email.split("@")[0]} 👋</h1><p>Una vista rápida de tu sitio web y su contenido.</p></div><a className="secondary-action" href="/" target="_blank" rel="noreferrer">Abrir sitio ↗</a></div>
              <div className="stats-grid">
                <article className="stat-card"><div className="stat-top"><span>Páginas</span><span className="stat-icon">▤</span></div><div className="stat-value">{pages.length}</div><div className="stat-note">Contenido de tu sitio</div></article>
                <article className="stat-card"><div className="stat-top"><span>Publicadas</span><span className="stat-icon">◉</span></div><div className="stat-value">{pages.filter((item) => item.status === "published").length}</div><div className="stat-note">Visibles para tus visitantes</div></article>
                <article className="stat-card"><div className="stat-top"><span>Borradores</span><span className="stat-icon">✎</span></div><div className="stat-value">{pages.filter((item) => item.status === "draft").length}</div><div className="stat-note">Listos para seguir editando</div></article>
              </div>
              <p className="section-label">CONTENIDO RECIENTE</p>
              <div className="panel-card">
                <h2 className="panel-title">Tus páginas <button className="table-action" type="button" onClick={() => setSection("pages")}>Ver todas →</button></h2>
                <PageTable pages={pages.slice(0, 5)} onSelect={openPage} />
              </div>
            </>
          )}
          {section === "pages" && (
            <div className="admin-heading"><div><h1>{page ? "Edita tu página" : "Páginas"}</h1><p>{page ? "Organiza el contenido con bloques y publica cuando esté listo." : "Crea y administra el contenido de tu sitio."}</p></div>
              {page
                ? <button className="quiet-action" type="button" onClick={() => setPage(null)}>← Todas las páginas</button>
                : <button className="primary-action" type="button" disabled={busy} onClick={createPage}>+ Nueva página</button>}
            </div>
          )}
          {section === "pages" && !page && <div className="panel-card"><PageTable pages={pages} onSelect={openPage} onCreate={createPage} /></div>}
          {section === "pages" && page && (
            <form onSubmit={savePage}>
              <div className="panel-card" style={{ marginBottom: 15 }}>
                <div className="block-fields" style={{ padding: 0 }}>
                  <div className="form-field"><label htmlFor="page-title">Nombre de la página</label><input id="page-title" required value={page.title} onChange={(event) => updatePage({ title: event.target.value })} /></div>
                  <div className="form-field"><label htmlFor="page-slug">Dirección web</label><input id="page-slug" required value={page.slug} onChange={(event) => updatePage({ slug: event.target.value })} /></div>
                  <div className="form-field"><label htmlFor="page-status">Visibilidad</label><select id="page-status" value={page.status} onChange={(event) => updatePage({ status: event.target.value as Page["status"] })}><option value="draft">Borrador — solo visible para ti</option><option value="published">Publicada — visible en el sitio</option></select></div>
                </div>
              </div>
              <div className="editor-toolbar"><p className="section-label" style={{ margin: 0 }}>BLOQUES DE CONTENIDO · {page.components.length}</p><select aria-label="Añadir bloque" value="" onChange={(event) => {
                const type = event.target.value as ComponentType;
                if (type) updatePage({ components: [...page.components, defaultBlock(type, page.components.length)] });
              }}><option value="">+ Añadir bloque</option><option value="hero">Portada</option><option value="text">Texto</option><option value="cards">Tarjetas</option><option value="cta">Llamado a la acción</option></select></div>
              {page.components.length === 0
                ? <div className="panel-card empty-state">Añade un bloque para empezar a diseñar esta página.</div>
                : <div className="block-list">{page.components.map((block, index) => (
                  <article className="block-card" key={`${block.id ?? "new"}-${index}`}>
                    <div className="block-card-head"><span className="block-type"><span className="nav-icon">{["✳", "¶", "▦", "↗"][(["hero", "text", "cards", "cta"] as ComponentType[]).indexOf(block.type)]}</span>{componentLabels[block.type]}</span>
                      <div className="block-card-actions"><button type="button" aria-label="Mover bloque arriba" disabled={index === 0} onClick={() => moveBlock(index, -1)}>↑</button><button type="button" aria-label="Mover bloque abajo" disabled={index === page.components.length - 1} onClick={() => moveBlock(index, 1)}>↓</button><button type="button" aria-label="Eliminar bloque" onClick={() => updatePage({ components: page.components.filter((_, itemIndex) => itemIndex !== index) })}>×</button></div>
                    </div>
                    {renderBlockFields(block, index)}
                  </article>
                ))}</div>}
              <div className="editor-footer"><button className="danger-action" type="button" onClick={deletePage}>Eliminar página</button><div className="form-actions"><button className="secondary-action" type="button" onClick={() => setPage(null)}>Cancelar</button><button className="primary-action" type="submit" disabled={busy}>{busy ? "Guardando..." : page.status === "published" ? "Guardar y publicar" : "Guardar borrador"}</button></div></div>
            </form>
          )}
          {section === "products" && <ProductManager />}
          {section === "appearance" && (
            <>
              <div className="admin-heading"><div><h1>La identidad de tu marca</h1><p>Actualiza los colores y la información que dan personalidad a tu sitio.</p></div></div>
              <form className="setting-form" onSubmit={saveConfig}>
                <div className="appearance-grid">
                  <section className="panel-card">
                    <h2 className="panel-title">Colores de marca</h2>
                    <div className="color-grid">
                      {([
                        ["primaryColor", "Color principal", "Botones y elementos destacados"],
                        ["accentColor", "Color de acento", "Pequeños detalles gráficos"],
                        ["backgroundColor", "Fondo del sitio", "Superficies principales"],
                        ["foregroundColor", "Texto principal", "Títulos y textos"],
                      ] as [keyof SiteConfig, string, string][]).map(([key, label, note]) => (
                        <label className="color-field" key={key}><input type="color" value={config[key] as string} onChange={(event) => setConfig((current) => ({ ...current, [key]: event.target.value }))} /><span><strong>{label}</strong><small>{note}</small></span></label>
                      ))}
                    </div>
                  </section>
                  <aside className="brand-preview"><span className="brand-mark">{config.name.slice(0, 1) || "N"}</span><strong>{config.name || "Nombre de marca"}</strong><small>Así se verá la identidad de tu sitio.</small></aside>
                </div>
                <div className="panel-card setting-form">
                  <h2 className="panel-title">Información del sitio</h2>
                  <div className="form-field"><label htmlFor="brand-name">Nombre de tu marca</label><input id="brand-name" maxLength={80} value={config.name} onChange={(event) => setConfig((current) => ({ ...current, name: event.target.value }))} /></div>
                  <div className="form-field"><label htmlFor="brand-description">Descripción breve</label><textarea id="brand-description" maxLength={250} value={config.description} onChange={(event) => setConfig((current) => ({ ...current, description: event.target.value }))} /></div>
                  <div className="form-field"><label htmlFor="whatsapp-phone">WhatsApp de pedidos</label><input id="whatsapp-phone" inputMode="tel" maxLength={24} placeholder="51987654321 (incluye el código de país)" value={config.whatsappPhone} onChange={(event) => setConfig((current) => ({ ...current, whatsappPhone: event.target.value }))} /><small className="field-hint">Solo números con código de país; por ejemplo, 51 para Perú.</small></div>
                  <div className="form-field"><span className="field-label">Logotipo</span><div className="upload-control"><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" aria-label="Seleccionar logotipo" onChange={(event) => uploadLogo(event.target.files?.[0])} />{config.logoUrl && <button className="quiet-action" type="button" onClick={() => setConfig((current) => ({ ...current, logoUrl: "" }))}>Quitar logo</button>}</div></div>
                  <div className="form-actions"><button className="primary-action" type="submit" disabled={busy}>{busy ? "Guardando..." : "Guardar identidad"}</button></div>
                </div>
              </form>
            </>
          )}
          {section === "menu" && (
            <>
              <div className="admin-heading"><div><h1>Menú de navegación</h1><p>Elige qué páginas ven tus visitantes y en qué orden aparecen.</p></div></div>
              <div className="panel-card">
                <h2 className="panel-title">Enlaces del menú</h2>
                <div className="menu-list">{menu.map((item, index) => (
                  <div className="menu-row" key={`${item.id}-${index}`}>
                    <input aria-label="Texto del enlace" value={item.label} placeholder="Nombre" onChange={(event) => setMenu((current) => current.map((entry, i) => i === index ? { ...entry, label: event.target.value } : entry))} />
                    <input aria-label="Dirección del enlace" value={item.href} placeholder="/pagina o https://" onChange={(event) => setMenu((current) => current.map((entry, i) => i === index ? { ...entry, href: event.target.value } : entry))} />
                    <label className="check-label"><input type="checkbox" checked={item.visible} onChange={(event) => setMenu((current) => current.map((entry, i) => i === index ? { ...entry, visible: event.target.checked } : entry))} /> Visible</label>
                    <div className="menu-actions">
                      <button type="button" aria-label="Mover enlace arriba" disabled={index === 0} onClick={() => moveMenuItem(index, -1)}>↑</button>
                      <button type="button" aria-label="Mover enlace abajo" disabled={index === menu.length - 1} onClick={() => moveMenuItem(index, 1)}>↓</button>
                      <button type="button" aria-label="Eliminar enlace" onClick={() => setMenu((current) => current.filter((_, i) => i !== index))}>×</button>
                    </div>
                  </div>
                ))}</div>
                {menu.length === 0 && <p className="empty-state">Aún no hay enlaces en el menú.</p>}
                <div className="form-actions" style={{ marginTop: 17 }}>
                  <button className="secondary-action" type="button" disabled={menu.length >= 20} onClick={() => setMenu((current) => [...current, { id: Date.now(), label: "Nueva página", href: "/", position: current.length, visible: true }])}>+ Añadir enlace</button>
                  <button className="primary-action" type="button" disabled={busy} onClick={saveMenu}>{busy ? "Guardando..." : "Guardar menú"}</button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function PageTable({ pages, onSelect, onCreate }: { pages: Page[]; onSelect: (page: Page) => void; onCreate?: () => void }) {
  if (pages.length === 0) {
    return <div className="empty-state">Todavía no hay páginas. {onCreate && <button className="table-action" type="button" onClick={onCreate}>Crea la primera →</button>}</div>;
  }
  return (
    <table className="page-table">
      <thead><tr><th>PÁGINA</th><th>ESTADO</th><th>ACTUALIZACIÓN</th><th /></tr></thead>
      <tbody>{pages.map((item) => (
        <tr key={item.id}><td><span className="page-name">{item.title}</span></td><td><span className={`status-pill ${item.status}`}>{item.status === "published" ? "Publicada" : "Borrador"}</span></td><td>{new Date(item.updatedAt).toLocaleDateString("es-MX")}</td><td><button className="table-action" type="button" onClick={() => onSelect(item)}>Editar →</button></td></tr>
      ))}</tbody>
    </table>
  );
}
