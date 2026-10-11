"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Product, SiteConfig } from "@/lib/types";

type CartItem = { product: Product; quantity: number };

const money = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });

function productImage(name: string): string {
  const normalizedName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalizedName.includes("audifono") || normalizedName.includes("audio") || normalizedName.includes("headphone")) return "/products/headphones.svg";
  if (normalizedName.includes("laptop") || normalizedName.includes("computadora") || normalizedName.includes("notebook")) return "/products/laptop.svg";
  if (normalizedName.includes("teclado")) return "/products/keyboard.svg";
  if (normalizedName.includes("mouse") || normalizedName.includes("raton")) return "/products/mouse.svg";
  return "/products/accessories.svg";
}

export function Storefront({ config, products }: { config: SiteConfig; products: Product[] }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [note, setNote] = useState("");
  const phone = config.whatsappPhone.replace(/\D/g, "");
  const totalItems = useMemo(() => cart.reduce((count, item) => count + item.quantity, 0), [cart]);
  const totalCents = useMemo(() => cart.reduce((total, item) => total + item.product.priceCents * item.quantity, 0), [cart]);

  function addProduct(product: Product) {
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      return existing
        ? current.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, { product, quantity: 1 }];
    });
  }

  function changeQuantity(productId: number, amount: number) {
    setCart((current) => current
      .map((item) => item.product.id === productId ? { ...item, quantity: item.quantity + amount } : item)
      .filter((item) => item.quantity > 0));
  }

  const orderMessage = [
    `Hola, quiero hacer un pedido en ${config.name}:`,
    ...cart.map(({ product, quantity }) => `- ${quantity} x ${product.name}: ${money.format(product.priceCents * quantity / 100)}`),
    `Total: ${money.format(totalCents / 100)}`,
    `Nombre: ${customerName.trim()}`,
    note.trim() ? `Nota: ${note.trim()}` : "",
  ].filter(Boolean).join("\n");
  const whatsappUrl = phone.length >= 8 && phone.length <= 15 && cart.length > 0 && customerName.trim()
    ? `https://wa.me/${phone}?text=${encodeURIComponent(orderMessage)}`
    : "";

  return (
    <>
      <header className="store-header">
        <Link className="site-brand" href="/" aria-label={`${config.name}, inicio`}>
          {config.logoUrl
            ? <Image src={config.logoUrl} alt="" width={140} height={38} />
            : <span className="brand-mark">{config.name.slice(0, 1) || "T"}</span>}
          <span>{config.name}</span>
        </Link>
        <nav aria-label="Navegación principal">
          <a href="#productos">Productos</a>
          <a href="#nosotros">La tienda</a>
        </nav>
        <button className="store-cart-button" type="button" onClick={() => setCartOpen(true)}>
          Tu carrito <span aria-label={`${totalItems} productos`}>{totalItems}</span>
        </button>
      </header>

      <main>
        <section className="store-hero">
          <div className="store-hero-orbit" aria-hidden="true" />
          <p className="eyebrow"><span /> AUDIO · COMPUTACIÓN · ACCESORIOS</p>
          <h1>Tu tecnología.<br /><em>A tu manera.</em></h1>
          <p>Audífonos, laptops y accesorios para acompañarte en tus clases, trabajo y tiempo libre.</p>
          <a className="button button-primary" href="#productos">Ver productos <span aria-hidden="true">↓</span></a>
          <div className="store-hero-stamp" aria-hidden="true">TECNOLOGÍA<br />PARA TU DÍA</div>
        </section>

        <section className="store-products content-width" id="productos">
          <div className="store-section-heading">
            <div><p className="eyebrow"><span /> NUESTRA SELECCIÓN</p><h2>Productos para ti</h2></div>
            <p>{products.length} {products.length === 1 ? "producto" : "productos"} disponibles</p>
          </div>
          {products.length === 0
            ? <div className="store-empty"><span>✳</span><h3>Pronto habrá novedades</h3><p>Estamos preparando productos para esta tienda.</p></div>
            : <div className="store-product-grid">{products.map((product, index) => (
              <article className="store-product-card" key={product.id}>
                <div className="store-product-art">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <Image
                    className="store-product-image"
                    src={productImage(product.name)}
                    alt={`Ilustración de ${product.name}`}
                    fill
                    sizes="(max-width: 600px) 90vw, (max-width: 800px) 45vw, 33vw"
                  />
                </div>
                <div className="store-product-info">
                  <div><h3>{product.name}</h3><p>{product.description || "Un favorito de nuestra tienda."}</p></div>
                  <div className="store-product-buy">
                    <strong>{money.format(product.priceCents / 100)}</strong>
                    <button className="add-cart-button" type="button" onClick={() => addProduct(product)}>Agregar <span aria-hidden="true">+</span></button>
                  </div>
                </div>
              </article>
            ))}</div>}
        </section>

        <section className="store-about" id="nosotros">
          <div className="content-width store-about-inner">
            <span className="store-about-mark" aria-hidden="true">⌁</span>
            <div><p className="eyebrow">EQUIPA TU DÍA A DÍA</p><h2>Tecnología que te acompaña.</h2><p>Arma tu carrito y coordinamos el pago y la entrega contigo por WhatsApp.</p></div>
            <a className="button button-light" href="#productos">Ver el catálogo <span aria-hidden="true">↗</span></a>
          </div>
        </section>
      </main>

      <footer className="store-footer content-width" id="contacto">
        <Link className="site-brand" href="/">
          {config.logoUrl
            ? <Image src={config.logoUrl} alt="" width={140} height={38} />
            : <span className="brand-mark">{config.name.slice(0, 1) || "T"}</span>}
          <span>{config.name}</span>
        </Link>
        <p>{config.description}</p>
        <span>© {new Date().getFullYear()} {config.name}</span>
      </footer>

      {cartOpen && (
        <div className="cart-backdrop" onClick={() => setCartOpen(false)}>
          <section className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title" onClick={(event) => event.stopPropagation()}>
            <div className="cart-drawer-head"><div><p className="eyebrow">TU COMPRA</p><h2 id="cart-title">Tu carrito · {totalItems}</h2></div><button className="cart-close" type="button" aria-label="Cerrar carrito" onClick={() => setCartOpen(false)}>×</button></div>
            {cart.length === 0
              ? <div className="cart-empty"><span>◈</span><p>Tu carrito está esperando algo especial.</p><button className="secondary-action" type="button" onClick={() => setCartOpen(false)}>Seguir mirando</button></div>
              : <>
                <div className="cart-items">{cart.map(({ product, quantity }) => (
                  <article className="cart-item" key={product.id}>
                    <div><strong>{product.name}</strong><span>{money.format(product.priceCents / 100)}</span></div>
                    <div className="cart-quantity"><button type="button" aria-label={`Quitar una unidad de ${product.name}`} onClick={() => changeQuantity(product.id, -1)}>−</button><span>{quantity}</span><button type="button" aria-label={`Agregar una unidad de ${product.name}`} onClick={() => changeQuantity(product.id, 1)}>+</button></div>
                  </article>
                ))}</div>
                <div className="cart-checkout">
                  <label htmlFor="customer-name">Tu nombre</label>
                  <input id="customer-name" required maxLength={100} value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="¿Cómo te llamas?" />
                  <label htmlFor="order-note">Nota para la tienda <span>(opcional)</span></label>
                  <textarea id="order-note" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Agrega detalles para tu pedido" />
                  <div className="cart-total"><span>Total</span><strong>{money.format(totalCents / 100)}</strong></div>
                  {phone.length < 8 || phone.length > 15
                    ? <p className="cart-warning">La tienda todavía no configuró un WhatsApp válido.</p>
                    : !customerName.trim()
                      ? <p className="cart-hint">Escribe tu nombre para preparar el pedido.</p>
                      : <a className="button button-primary cart-whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer">Enviar pedido por WhatsApp <span aria-hidden="true">↗</span></a>}
                  <p className="cart-hint">El pago y la entrega se coordinan directamente con la tienda.</p>
                </div>
              </>}
          </section>
        </div>
      )}
    </>
  );
}
