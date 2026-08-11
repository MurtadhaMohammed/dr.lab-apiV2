const DEFAULT_TAKE = 10;
const MAX_TAKE = 100;

// Normalises ?take/?skip/?q so a bad query string can never produce a huge or
// negative page.
const parsePaging = (query = {}) => {
  const rawTake = parseInt(query.take);
  const rawSkip = parseInt(query.skip);

  const take = Number.isNaN(rawTake)
    ? DEFAULT_TAKE
    : Math.min(Math.max(rawTake, 1), MAX_TAKE);
  const skip = Number.isNaN(rawSkip) ? 0 : Math.max(rawSkip, 0);
  const q = String(query.q || "").trim();

  return { take, skip, q };
};

module.exports = { parsePaging, DEFAULT_TAKE, MAX_TAKE };
