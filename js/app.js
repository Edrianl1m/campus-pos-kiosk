(function () {
  "use strict";

  /* =========================================================
     DATA
     Hard-coded product list. A small kiosk menu like this does
     not need a database; prices live in one place.
     ========================================================= */
  const PRODUCTS = [
    {
      id: "coffee",
      name: "Coffee",
      price: 45,
      category: "Drinks",
      icon: "coffee",
      tint: "orange",
    },
    {
      id: "sandwich",
      name: "Sandwich",
      price: 50,
      category: "Food",
      icon: "sandwich",
      tint: "yellow",
    },
    {
      id: "softdrink",
      name: "Soft Drink",
      price: 35,
      category: "Drinks",
      icon: "soda",
      tint: "red",
    },
    {
      id: "cookies",
      name: "Cookies",
      price: 25,
      category: "Snacks",
      icon: "cookie",
      tint: "tan",
    },
    {
      id: "water",
      name: "Bottled Water",
      price: 20,
      category: "Drinks",
      icon: "bottle",
      tint: "blue",
    },
    {
      id: "chocolate",
      name: "Chocolate",
      price: 25,
      category: "Snacks",
      icon: "choco",
      tint: "brown",
    },
  ];
  const CATEGORIES = ["All", "Drinks", "Food", "Snacks"];
  const MAX_QTY = 20; // per item, keeps orders realistic
  const MAX_CASH_DIGITS = 6; // up to ₱999,999
  const QUICK_BILLS = [200, 500, 1000];
  const METHOD_NAMES = {
    cash: "Cash",
    qr: "QR Payment",
    card: "Credit/Debit Card",
  };
  const TXN_KEY = "campus-store-pos:txn-seq";

  /* =========================================================
     STATE — everything the kiosk knows lives here.
     ========================================================= */
  const state = {
    screen: "order",
    filter: "All",
    cart: [], // [{ id, name, price, qty }] in the order items were added
    cashInput: "", // digits typed on the keypad
    cashTried: false, // show validation only after Pay Now is pressed
    qrRef: "",
    busy: false, // true while a simulated QR/card payment is processing
    transaction: null, // snapshot of the completed sale (used by success + receipt)
  };

  /* =========================================================
     PURE CALCULATIONS
     ========================================================= */
  const lineSubtotal = (line) => line.price * line.qty; // Subtotal = Unit Price × Quantity
  const orderTotal = (cart) =>
    cart.reduce((sum, l) => sum + lineSubtotal(l), 0); // Total = sum of subtotals
  const itemCount = (cart) => cart.reduce((sum, l) => sum + l.qty, 0);

  function money(n) {
    return (
      "₱" +
      n.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }
  function itemsLabel(n) {
    return n + (n === 1 ? " item" : " items");
  }

  // Cash validation: blank, invalid, negative and insufficient amounts are rejected.
  function validateCash(input, total) {
    if (input === "") {
      return {
        ok: false,
        title: "Enter the amount paid.",
        detail:
          "Use the number pad or a quick amount. At least " +
          money(total) +
          " is needed.",
      };
    }
    const amount = Number(input);
    if (!Number.isFinite(amount) || amount < 0) {
      return {
        ok: false,
        title: "Invalid amount.",
        detail: "Please enter a valid peso amount.",
      };
    }
    if (amount < total) {
      return {
        ok: false,
        amount,
        title: "Insufficient payment.",
        detail:
          "Please enter at least " +
          money(total) +
          ". You are short by " +
          money(total - amount) +
          ".",
      };
    }
    return { ok: true, amount, change: amount - total }; // Change = Amount Paid − Total
  }

  // Sequential transaction numbers (TXN-2026-00001, -00002, …).
  // The counter is kept in this browser's storage so numbers stay unique across reloads;
  // if storage is unavailable, an in-memory counter still keeps them unique for this session.
  let memorySeq = 0;
  function nextTransactionNumber() {
    let seq = memorySeq + 1;
    try {
      const stored = parseInt(localStorage.getItem(TXN_KEY), 10);
      if (stored >= seq) seq = stored + 1;
      localStorage.setItem(TXN_KEY, String(seq));
    } catch (e) {
      /* storage blocked: fall back to memory */
    }
    memorySeq = seq;
    return (
      "TXN-" + new Date().getFullYear() + "-" + String(seq).padStart(5, "0")
    );
  }

  /* =========================================================
     ICONS (inline SVG, no external files)
     ========================================================= */
  const s = (body, sw) =>
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' +
    (sw || 1.8) +
    '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    body +
    "</svg>";
  const ICON = {
    coffee: s(
      '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8.5 3.5v2.5M11.5 3.5v2.5M14.5 3.5v2.5"/>',
    ),
    sandwich: s(
      '<path d="M3 16 12 7l9 9z"/><path d="M3 16h18v2.5H3z"/><path d="M7 12h10"/>',
    ),
    soda: s(
      '<path d="M6 8h12l-1.4 12.2a1 1 0 0 1-1 .8H8.4a1 1 0 0 1-1-.8z"/><path d="M5 8h14"/><path d="M12 8l1.5-5H17"/><path d="M7 13h10"/>',
    ),
    cookie: s(
      '<circle cx="12" cy="12" r="8.5"/><circle cx="9" cy="9.5" r="1.1" fill="currentColor"/><circle cx="14.5" cy="9" r="1.1" fill="currentColor"/><circle cx="10.5" cy="14.5" r="1.1" fill="currentColor"/><circle cx="15" cy="14" r="1.1" fill="currentColor"/>',
    ),
    bottle: s(
      '<path d="M10 2.5h4v3l1.5 2.5v12a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 8.5 20V8L10 5.5z"/><path d="M8.5 11h7M8.5 15.5h7"/>',
    ),
    choco: s(
      '<rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M12 3.5v17M5 9.2h14M5 14.8h14"/>',
    ),
    plus: s('<path d="M12 5v14M5 12h14"/>', 2.4),
    minus: s('<path d="M5 12h14"/>', 2.4),
    trash: s(
      '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5"/>',
      2,
    ),
    arrowRight: s('<path d="M5 12h14M13 6l6 6-6 6"/>', 2.2),
    arrowLeft: s('<path d="M19 12H5M11 6l-6 6 6 6"/>', 2.2),
    check: s('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 2.6),
    checkBig: s('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 3),
    cart: s(
      '<path d="M3 4h2.5l2.2 11h10.6L20.5 8H7"/><circle cx="9.5" cy="19.5" r="1.4"/><circle cx="16.5" cy="19.5" r="1.4"/>',
    ),
    cash: s(
      '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9.5v.01M18 14.5v.01"/>',
      2,
    ),
    qr: s(
      '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2.5v2.5H14zM19.5 14v6M14 19.5h3"/>',
      2,
    ),
    card: s(
      '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/>',
      2,
    ),
    alert: s(
      '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>',
      2.2,
    ),
    backspace: s(
      '<path d="M21 5H9l-6 7 6 7h12z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/>',
      2,
    ),
    receipt: s(
      '<path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
      2,
    ),
  };

  /* =========================================================
     DOM HELPERS
     ========================================================= */
  const $ = (id) => document.getElementById(id);
  const esc = (t) =>
    String(t).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );

  function fillIcons(root) {
    root.querySelectorAll("[data-icon]").forEach((el) => {
      if (!el.firstChild) el.innerHTML = ICON[el.dataset.icon] || "";
    });
  }

  let toastTimer = null;
  function toast(message, kind) {
    const el = $("toast");
    el.className = "toast" + (kind === "error" ? " error" : "");
    el.innerHTML =
      (kind === "error" ? ICON.alert : ICON.check) +
      "<span>" +
      esc(message) +
      "</span>";
    requestAnimationFrame(() => el.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2300);
  }

  /* =========================================================
     NAVIGATION
     [steps completed, current step index] for the header tracker
     ========================================================= */
  const STEPS = ["Order", "Review", "Payment", "Receipt"];
  const STEP_STATE = {
    order: [0, 0],
    review: [1, 1],
    method: [2, 2],
    cash: [2, 2],
    qr: [2, 2],
    card: [2, 2],
    success: [3, -1],
    receipt: [3, 3],
  };
  const RENDER = {};

  function go(screen) {
    state.screen = screen;
    document.querySelectorAll("main > .screen").forEach((sec) => {
      sec.hidden = sec.id !== "screen-" + screen;
    });
    renderSteps();
    if (RENDER[screen]) RENDER[screen]();
    window.scrollTo(0, 0);
    const h = $("screen-" + screen).querySelector("h1");
    if (h) h.focus({ preventScroll: true });
  }

  function renderSteps() {
    const [done, cur] = STEP_STATE[state.screen];
    $("steps").innerHTML = STEPS.map((label, i) => {
      const cls = i < done ? "is-done" : i === cur ? "is-current" : "";
      const mark = i < done ? ICON.check : String(i + 1);
      return (
        '<li class="step ' +
        cls +
        '"' +
        (i === cur ? ' aria-current="step"' : "") +
        ">" +
        '<span class="step-mark">' +
        mark +
        '</span><span class="step-text">' +
        label +
        "</span></li>"
      );
    }).join("");
  }

  /* =========================================================
     STEP 1 — ITEM SELECTION + CART
     ========================================================= */
  function findLine(id) {
    return state.cart.find((l) => l.id === id);
  }

  function addProduct(id) {
    const product = PRODUCTS.find((p) => p.id === id);
    const line = findLine(id);
    if (line && line.qty >= MAX_QTY) {
      toast("Invalid quantity. Maximum is " + MAX_QTY + " per item.", "error");
      return;
    }
    if (line) line.qty += 1;
    else
      state.cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        qty: 1,
      });
    toast("Product added — " + product.name);
    renderOrder();
  }

  function changeQty(id, delta) {
    const line = findLine(id);
    if (!line) return;
    const next = line.qty + delta;
    if (next > MAX_QTY) {
      toast("Invalid quantity. Maximum is " + MAX_QTY + " per item.", "error");
      return;
    }
    if (next <= 0) {
      removeLine(id);
      return;
    } // quantity never goes below 1; going lower removes the item
    line.qty = next;
    renderOrder();
  }

  function removeLine(id) {
    const line = findLine(id);
    state.cart = state.cart.filter((l) => l.id !== id);
    if (line) toast("Removed — " + line.name);
    renderOrder();
  }

  function renderOrder() {
    $("filters").innerHTML = CATEGORIES.map(
      (c) =>
        '<button class="chip" data-action="filter" data-filter="' +
        c +
        '" aria-pressed="' +
        (state.filter === c) +
        '">' +
        c +
        "</button>",
    ).join("");

    const visible = PRODUCTS.filter(
      (p) => state.filter === "All" || p.category === state.filter,
    );
    $("product-grid").innerHTML = visible
      .map((p) => {
        const line = findLine(p.id);
        return (
          '<button class="product' +
          (line ? " in-cart" : "") +
          '" data-action="add" data-id="' +
          p.id +
          '" aria-label="Add ' +
          esc(p.name) +
          ", " +
          money(p.price) +
          (line ? ", " + line.qty + " in order" : "") +
          '">' +
          (line
            ? '<span class="badge" aria-hidden="true">' + line.qty + "</span>"
            : "") +
          '<span class="product-tile tint-' +
          p.tint +
          '">' +
          ICON[p.icon] +
          "</span>" +
          '<span class="product-meta"><span class="product-name">' +
          esc(p.name) +
          '</span><span class="product-price">' +
          money(p.price) +
          "</span></span>" +
          "</button>"
        );
      })
      .join("");

    const count = itemCount(state.cart);
    $("cart-count").textContent = itemsLabel(count);
    $("cart-total").textContent = money(orderTotal(state.cart));
    $("btn-proceed").setAttribute(
      "aria-disabled",
      String(state.cart.length === 0),
    );

    if (state.cart.length === 0) {
      $("cart-list").innerHTML =
        '<div class="cart-empty"><span class="empty-icon">' +
        ICON.cart +
        "</span><strong>Your order is empty</strong><p>Tap a product on the left to add it to your order.</p></div>";
      return;
    }
    $("cart-list").innerHTML = state.cart
      .map(
        (l) =>
          '<div class="cart-line">' +
          '<div class="cart-line-top"><div><div class="cart-line-name">' +
          esc(l.name) +
          '</div><div class="cart-line-each">' +
          money(l.price) +
          " each</div></div>" +
          '<button class="remove-btn" data-action="remove" data-id="' +
          l.id +
          '" aria-label="Remove ' +
          esc(l.name) +
          '">' +
          ICON.trash +
          "</button></div>" +
          '<div class="cart-line-bottom"><div class="stepper">' +
          '<button class="qty-btn" data-action="dec" data-id="' +
          l.id +
          '" aria-label="Decrease ' +
          esc(l.name) +
          '">' +
          ICON.minus +
          "</button>" +
          '<span class="qty-val" aria-label="Quantity">' +
          l.qty +
          "</span>" +
          '<button class="qty-btn plus" data-action="inc" data-id="' +
          l.id +
          '" aria-label="Increase ' +
          esc(l.name) +
          '">' +
          ICON.plus +
          "</button>" +
          '</div><span class="line-sub">' +
          money(lineSubtotal(l)) +
          "</span></div>" +
          "</div>",
      )
      .join("");
  }
  RENDER.order = renderOrder;

  /* =========================================================
     STEP 2 — ORDER SUMMARY
     ========================================================= */
  RENDER.review = function () {
    $("review-body").innerHTML = state.cart
      .map(
        (l) =>
          '<tr><td class="name">' +
          esc(l.name) +
          '</td><td class="qty">' +
          l.qty +
          '</td><td class="num unit">' +
          money(l.price) +
          '</td><td class="num sub">' +
          money(lineSubtotal(l)) +
          "</td></tr>",
      )
      .join("");
    $("review-count").textContent = itemsLabel(itemCount(state.cart));
    $("review-total").textContent = money(orderTotal(state.cart));
  };

  /* =========================================================
     STEP 3 — PAYMENT METHOD
     ========================================================= */
  RENDER.method = function () {
    $("method-due").textContent = money(orderTotal(state.cart));
  };

  function chooseMethod(method) {
    if (method === "cash") {
      state.cashInput = "";
      state.cashTried = false;
    }
    if (method === "qr") {
      state.qrRef = "QR-" + Date.now().toString(36).toUpperCase();
    }
    go(method);
  }

  /* =========================================================
     STEP 4a — CASH
     ========================================================= */
  function buildKeypad() {
    const keys = [
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "clear",
      "0",
      "back",
    ];
    $("keypad").innerHTML = keys
      .map((k) => {
        if (k === "clear")
          return '<button class="key fn" data-action="key" data-key="clear">Clear</button>';
        if (k === "back")
          return (
            '<button class="key fn" data-action="key" data-key="back" aria-label="Delete last digit">' +
            ICON.backspace +
            "</button>"
          );
        return (
          '<button class="key" data-action="key" data-key="' +
          k +
          '">' +
          k +
          "</button>"
        );
      })
      .join("");
  }

  function pressKey(key) {
    if (key === "clear") state.cashInput = "";
    else if (key === "back") state.cashInput = state.cashInput.slice(0, -1);
    else {
      if (state.cashInput.length >= MAX_CASH_DIGITS) {
        toast("That amount is too large.", "error");
        return;
      }
      state.cashInput = state.cashInput === "0" ? key : state.cashInput + key;
    }
    RENDER.cash();
  }

  function setCash(amount) {
    state.cashInput = String(amount);
    RENDER.cash();
  }

  RENDER.cash = function () {
    const total = orderTotal(state.cart);
    const v = validateCash(state.cashInput, total);
    const showError = state.cashTried && !v.ok;

    $("cash-total").textContent = money(total);
    const display = $("cash-display");
    display.textContent =
      state.cashInput === "" ? "₱0.00" : money(Number(state.cashInput));
    display.classList.toggle("is-empty", state.cashInput === "");
    display.classList.toggle("is-invalid", showError);

    $("cash-error").hidden = !showError;
    if (showError) {
      $("cash-error-title").textContent = v.title;
      $("cash-error-detail").textContent = " " + v.detail;
    }

    const options = [{ label: "Exact", value: total }].concat(
      QUICK_BILLS.map((b) => ({
        label: money(b).replace(".00", ""),
        value: b,
      })),
    );
    $("quick").innerHTML = options
      .map(
        (o) =>
          '<button class="quick-btn' +
          (state.cashInput !== "" && Number(state.cashInput) === o.value
            ? " is-selected"
            : "") +
          '" data-action="quick" data-amount="' +
          o.value +
          '">' +
          o.label +
          "</button>",
      )
      .join("");

    const box = $("cash-change");
    box.classList.toggle("is-ok", v.ok);
    $("cash-change-amt").textContent = v.ok ? money(v.change) : "—";
    $("cash-change-formula").textContent = v.ok
      ? money(v.amount) + " − " + money(total)
      : "";
  };

  function payCash() {
    const total = orderTotal(state.cart);
    const v = validateCash(state.cashInput, total);
    if (!v.ok) {
      state.cashTried = true; // stay on this screen and show the reason
      RENDER.cash();
      toast(v.title, "error");
      return;
    }
    completePayment("cash", v.amount);
  }

  /* =========================================================
     STEP 4b — QR (simulated)
     A decorative QR-style pattern seeded from the reference
     number. It is a placeholder, not a scannable code.
     ========================================================= */
  function demoQrSvg(seedText) {
    const N = 25;
    let h = 2166136261;
    for (const ch of seedText) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    let seed = h >>> 0;
    const rand = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const nearFinder = (x, y) =>
      (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8);
    let cells = "";
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        if (!nearFinder(x, y) && rand() < 0.5)
          cells += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>';
      }
    const finder = (x, y) =>
      '<rect class="qr-ink" x="' +
      x +
      '" y="' +
      y +
      '" width="7" height="7"/>' +
      '<rect class="qr-bg" x="' +
      (x + 1) +
      '" y="' +
      (y + 1) +
      '" width="5" height="5"/>' +
      '<rect class="qr-ink" x="' +
      (x + 2) +
      '" y="' +
      (y + 2) +
      '" width="3" height="3"/>';
    return (
      '<svg viewBox="-1 -1 27 27" shape-rendering="crispEdges" aria-hidden="true">' +
      '<rect class="qr-bg" x="-1" y="-1" width="27" height="27"/><g class="qr-ink">' +
      cells +
      "</g>" +
      finder(0, 0) +
      finder(N - 7, 0) +
      finder(0, N - 7) +
      "</svg>"
    );
  }

  RENDER.qr = function () {
    const total = money(orderTotal(state.cart));
    $("qr-amount").textContent = total;
    $("qr-amount-2").textContent = total;
    $("qr-ref").textContent = state.qrRef;
    $("qr-code").innerHTML = demoQrSvg(state.qrRef);
    $("qr-status").hidden = true;
    setBusy(["qr-back", "qr-confirm"], false);
  };

  function confirmQr() {
    if (state.busy) return;
    state.busy = true;
    $("qr-status").hidden = false;
    setBusy(["qr-back", "qr-confirm"], true);
    setTimeout(() => {
      state.busy = false;
      completePayment("qr", orderTotal(state.cart));
    }, 1100);
  }

  /* =========================================================
     STEP 4c — CARD (simulated)
     ========================================================= */
  RENDER.card = function () {
    const total = money(orderTotal(state.cart));
    $("card-amount").textContent = total;
    $("card-art-amt").textContent = total;
    $("card-status").hidden = true;
    const bar = $("card-progress");
    bar.style.transitionDuration = "0ms";
    bar.style.width = "0";
    setBusy(["card-back", "card-process"], false);
  };

  function processCard() {
    if (state.busy) return;
    state.busy = true;
    const ms = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 900
      : 2400;
    $("card-status").hidden = false;
    setBusy(["card-back", "card-process"], true);
    const bar = $("card-progress");
    void bar.offsetWidth; // restart the transition
    bar.style.transitionDuration = ms + "ms";
    bar.style.width = "100%";
    setTimeout(() => {
      state.busy = false;
      completePayment("card", orderTotal(state.cart));
    }, ms + 150);
  }

  function setBusy(ids, busy) {
    ids.forEach((id) => {
      $(id).disabled = busy;
    });
  }

  /* =========================================================
     COMPLETE PAYMENT → STEP 5
     The order is copied into a transaction record so the receipt
     shows exactly what was paid for.
     ========================================================= */
  function completePayment(method, amountPaid) {
    const total = orderTotal(state.cart);
    if (state.cart.length === 0 || amountPaid < total) return; // safety net: never record an invalid sale
    state.transaction = {
      number: nextTransactionNumber(),
      date: new Date(),
      method: METHOD_NAMES[method],
      items: state.cart.map((l) => ({ ...l })),
      total,
      amountPaid,
      change: amountPaid - total, // QR and card: paid = total, so change = ₱0.00
    };
    go("success");
    toast("Transaction completed successfully");
  }

  RENDER.success = function () {
    const t = state.transaction;
    const row = (k, v, cls) =>
      "<div><dt>" +
      k +
      "</dt><dd" +
      (cls ? ' class="' + cls + '"' : "") +
      ">" +
      v +
      "</dd></div>";
    $("success-details").innerHTML =
      row("Transaction No.", t.number, "mono") +
      row("Payment method", t.method) +
      row("Transaction amount", money(t.total)) +
      row("Amount paid", money(t.amountPaid)) +
      row("Change", money(t.change), "change");
  };

  /* =========================================================
     STEP 6 — RECEIPT
     ========================================================= */
  RENDER.receipt = function () {
    const t = state.transaction;
    const date = t.date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const time = t.date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    const row = (a, b, cls) =>
      '<div class="rc-row' +
      (cls ? " " + cls : "") +
      '"><span>' +
      a +
      "</span><span>" +
      b +
      "</span></div>";
    $("receipt").innerHTML =
      '<div class="rc-head"><h2>CAMPUS STORE POS</h2><p>Self-Service Kiosk · Official Digital Receipt</p></div>' +
      '<hr class="rc-rule">' +
      row("Transaction No.", t.number) +
      row("Date", date + " · " + time) +
      '<hr class="rc-rule">' +
      '<div class="rc-row rc-label"><span>Item</span><span>Subtotal</span></div>' +
      t.items
        .map(
          (l) =>
            '<div class="rc-item">' +
            row(
              "<strong>" + esc(l.name) + "</strong>",
              money(lineSubtotal(l)),
            ) +
            '<div class="rc-calc">' +
            l.qty +
            " × " +
            money(l.price) +
            "</div></div>",
        )
        .join("") +
      '<hr class="rc-rule">' +
      row("TOTAL", money(t.total), "rc-total") +
      '<div style="height:10px"></div>' +
      row("Payment method", t.method) +
      row("Amount paid", money(t.amountPaid)) +
      row("Change", money(t.change)) +
      row("Status", '<span class="rc-status">Payment Successful</span>') +
      '<hr class="rc-rule">' +
      '<p class="rc-foot">Thank you for your purchase!</p>';
  };

  /* =========================================================
     STEP 7 — NEW TRANSACTION (full reset)
     ========================================================= */
  function newTransaction() {
    state.cart = [];
    state.filter = "All";
    state.cashInput = "";
    state.cashTried = false;
    state.qrRef = "";
    state.busy = false;
    state.transaction = null;
    go("order");
    toast("New transaction started — previous order cleared");
  }

  /* =========================================================
     EVENTS — one click listener routes every button by data-action
     ========================================================= */
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn || btn.disabled) return;
    const { action, id } = btn.dataset;

    switch (action) {
      case "filter":
        state.filter = btn.dataset.filter;
        renderOrder();
        break;
      case "add":
        addProduct(id);
        break;
      case "inc":
        changeQty(id, +1);
        break;
      case "dec":
        changeQty(id, -1);
        break;
      case "remove":
        removeLine(id);
        break;
      case "proceed":
        if (state.cart.length === 0) {
          toast("Add at least one product to continue.", "error");
          break;
        }
        go("review");
        break;
      case "back-to-order":
        go("order");
        break;
      case "to-payment":
        go("method");
        break;
      case "back-to-review":
        go("review");
        break;
      case "choose-method":
        chooseMethod(btn.dataset.method);
        break;
      case "change-method":
        if (!state.busy) go("method");
        break;
      case "key":
        pressKey(btn.dataset.key);
        break;
      case "quick":
        setCash(Number(btn.dataset.amount));
        break;
      case "pay-cash":
        payCash();
        break;
      case "confirm-qr":
        confirmQr();
        break;
      case "process-card":
        processCard();
        break;
      case "view-receipt":
        go("receipt");
        break;
      case "new-transaction":
        newTransaction();
        break;
    }
  });

  // Physical keyboard also works on the cash screen (handy when testing on a laptop).
  document.addEventListener("keydown", (e) => {
    if (state.screen !== "cash" || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[0-9]$/.test(e.key)) {
      pressKey(e.key);
      e.preventDefault();
    } else if (e.key === "Backspace") {
      pressKey("back");
      e.preventDefault();
    } else if (e.key === "Escape") {
      pressKey("clear");
    } else if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) {
      payCash();
      e.preventDefault();
    }
  });

  /* ---------- Start ---------- */
  fillIcons(document);
  buildKeypad();
  go("order");

  // Installable / offline kiosk (PWA). Only works when served over http(s), e.g. GitHub Pages.
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
