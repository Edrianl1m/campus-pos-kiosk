# Product photos

Put one photo per product in this folder, using **exactly** these file names:

| Product       | File name       |
| ------------- | --------------- |
| Coffee        | `coffee.png`    |
| Sandwich      | `sandwich.png`  |
| Soft Drink    | `soda.png`      |
| Cookies       | `cookie.png`    |
| Bottled Water | `water.png`     |
| Chocolate     | `chocolate.png` |

**Photo guidelines**

- Format: `.png` or `.jpg`. Landscape **4:3** (for example 800 × 600 px). Other sizes work but get cropped to fill the card.
- Keep each file under about **200 KB** so the kiosk loads fast. [squoosh.app](https://squoosh.app) can shrink them.
- Keep the food in the center; the edges may be cropped.
- Only use photos the team took or is allowed to use (your own photos, or free-license sites like Unsplash or Pexels).

No code changes are needed. When a photo is missing, the card shows its icon instead, so you can add the photos one at a time.
To use a different file name or format, change the `image:` path for that product in `js/app.js`.
