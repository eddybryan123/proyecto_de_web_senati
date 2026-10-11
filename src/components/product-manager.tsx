"use client";

import { FormEvent, useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import type { Product } from "@/lib/types";

type ProductForm = { name: string; description: string; price: string; isActive: boolean };

const emptyForm: ProductForm = { name: "", description: "", price: "", isActive: true };
const money = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });

export function ProductManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let mounted = true;
    fetchJson<Product[]>("/api/products")
      .then((items) => { if (mounted) setProducts(items); })
      .catch((cause: unknown) => {
        if (mounted) setError(cause instanceof Error ? cause.message : "No se pudieron cargar los productos.");
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  function startEditing(product: Product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      description: product.description,
      price: (product.priceCents / 100).toFixed(2),
      isActive: product.isActive,
    });
    setError("");
    setNotice("");
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const priceCents = Math.round(Number(form.price) * 100);
    if (!Number.isSafeInteger(priceCents) || priceCents < 1) {
      setError("El precio debe ser mayor que cero y tener hasta dos decimales.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = { name: form.name, description: form.description, priceCents, isActive: form.isActive };
      const saved = await fetchJson<Product>(
        editingId ? `/api/products/${editingId}` : "/api/products",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      setProducts((current) => editingId
        ? current.map((product) => product.id === saved.id ? saved : product)
        : [saved, ...current]);
      setNotice(editingId ? "El producto se actualizó." : "El producto se agregó a la tienda.");
      cancelEditing();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar el producto.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`¿Eliminar “${product.name}” de la tienda?`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fetchJson(`/api/products/${product.id}`, { method: "DELETE" });
      setProducts((current) => current.filter((item) => item.id !== product.id));
      if (editingId === product.id) cancelEditing();
      setNotice("El producto se eliminó.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo eliminar el producto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="admin-heading">
        <div><h1>Productos</h1><p>Administra lo que aparece en el catálogo de tu tienda.</p></div>
      </div>
      {error && <p className="error-message" role="alert">{error}</p>}
      {notice && <p className="success-message" role="status">{notice}</p>}
      <form className="panel-card product-form setting-form" onSubmit={saveProduct}>
        <h2 className="panel-title">{editingId ? "Editar producto" : "Agregar producto"}</h2>
        <div className="form-field">
          <label htmlFor="product-name">Nombre</label>
          <input id="product-name" required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </div>
        <div className="form-field">
          <label htmlFor="product-description">Descripción</label>
          <textarea id="product-description" maxLength={2000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </div>
        <div className="product-form-options">
          <div className="form-field">
            <label htmlFor="product-price">Precio (S/)</label>
            <input id="product-price" required type="number" min="0.01" max="10000000" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} />
          </div>
          <label className="check-label"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Visible en la tienda</label>
        </div>
        <div className="form-actions">
          {editingId && <button className="secondary-action" type="button" onClick={cancelEditing}>Cancelar</button>}
          <button className="primary-action" type="submit" disabled={busy}>{busy ? "Guardando..." : editingId ? "Guardar cambios" : "Agregar producto"}</button>
        </div>
      </form>
      <section className="panel-card product-list-panel">
        <h2 className="panel-title">Catálogo · {products.length}</h2>
        {loading ? <p className="empty-state">Cargando productos...</p> : products.length === 0
          ? <p className="empty-state">Todavía no hay productos. Agrega el primero para empezar a llenar tu tienda.</p>
          : <div className="product-admin-list">{products.map((product) => (
            <article className="product-admin-row" key={product.id}>
              <div>
                <strong>{product.name}</strong>
                <p>{product.description || "Sin descripción"}</p>
              </div>
              <span className="product-admin-price">{money.format(product.priceCents / 100)}</span>
              <span className={`status-pill${product.isActive ? "" : " draft"}`}>{product.isActive ? "Visible" : "Oculto"}</span>
              <div className="product-admin-actions">
                <button className="quiet-action" type="button" disabled={busy} onClick={() => startEditing(product)}>Editar</button>
                <button className="danger-action" type="button" disabled={busy} onClick={() => deleteProduct(product)}>Eliminar</button>
              </div>
            </article>
          ))}</div>}
      </section>
    </>
  );
}
