# Campus Store POS Kiosk

Touchscreen self-service Point of Sale kiosk for a small campus food and merchandise outlet.
IT415 – Application Development and Emerging Technologies, Practical Examination.

**Live app:** https://edrianl1m.github.io/campus-pos-kiosk/

## Transaction flow

1. **Item Selection**: tap product cards, adjust quantities with − / +, remove items
2. **Order Summary**: review items, quantities, unit prices, subtotals and total
3. **Payment Method**: Cash, QR Payment, or Credit/Debit Card
4. **Payment Processing**
   - Cash: on-screen number pad and quick amounts; rejects blank or insufficient amounts; computes change
   - QR: demo QR placeholder with a reference number and Confirm Payment (simulated)
   - Card: tap/insert/swipe instruction with a processing state (simulated)
5. **Payment Successful**: transaction number, method, amount, amount paid, change
6. **Receipt**: digital receipt with reference, date, items, totals and payment details
7. **New Transaction**: clears the order and payment and returns to Item Selection

## Computation rules

| Value | Formula |
|---|---|
| Subtotal | Unit price × Quantity |
| Total | Sum of all subtotals |
| Change (cash) | Amount paid − Total |
| QR / Card | Amount paid = Total, change = ₱0.00 |

## Products

| Product | Price |
|---|---|
| Coffee | ₱45.00 |
| Sandwich | ₱50.00 |
| Soft Drink | ₱35.00 |
| Cookies | ₱25.00 |
| Bottled Water | ₱20.00 |
| Chocolate | ₱25.00 |

## Technology and data storage

- Plain HTML, CSS and JavaScript. No framework, no build step, no backend.
- Product data is hard-coded in `js/app.js`. The menu is small and fixed, so a database adds no value here.
- Each completed sale is copied into its own transaction record, so the receipt always shows what was actually paid.
- The transaction counter (`TXN-YYYY-00001`, `-00002`, …) is saved in the browser's Local Storage so numbers stay unique after a reload.
- Installable Progressive Web App (`manifest.webmanifest`, `sw.js`). It opens full-screen like a kiosk and keeps working offline once loaded.

## Project structure

```
index.html            Screens (markup only)
css/style.css         Layout, touch sizing, light/dark theme
js/app.js             Products, cart, calculations, payments, receipt
manifest.webmanifest  PWA settings (full-screen kiosk)
sw.js                 Offline cache
icons/                App icons
```

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
# or
python -m http.server 8000
```

## Deployment

Hosted on GitHub Pages from the `main` branch (Settings → Pages → Deploy from a branch → `main` / root).
Every merge into `main` redeploys automatically.
