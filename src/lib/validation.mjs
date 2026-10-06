function parseFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cleanNotes(value) {
  return String(value ?? "").trim().slice(0, 500);
}

export function validateSetInput(input = {}) {
  const errors = [];
  const weightKg = parseFiniteNumber(input.weightKg);
  const reps = parseFiniteNumber(input.reps);

  if (weightKg === null || weightKg < 0 || weightKg > 500) {
    errors.push("weightKg must be between 0 and 500");
  }
  if (reps === null || !Number.isInteger(reps) || reps < 1 || reps > 100) {
    errors.push("reps must be an integer between 1 and 100");
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      weightKg,
      reps,
      notes: cleanNotes(input.notes),
    },
  };
}

export function validateBodyWeightInput(input = {}) {
  const errors = [];
  const weightKg = parseFiniteNumber(input.weightKg);
  const entryDate = String(input.entryDate ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
    errors.push("entryDate must be YYYY-MM-DD");
  }
  if (weightKg === null || weightKg < 20 || weightKg > 300) {
    errors.push("weightKg must be between 20 and 300");
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { entryDate, weightKg } };
}

export function validateExerciseMediaInput(input = {}) {
  const techniqueMediaType = String(input.techniqueMediaType ?? input.mediaType ?? "link").trim();
  const techniqueMediaUrl = String(input.techniqueMediaUrl ?? input.mediaUrl ?? "").trim();
  const allowed = new Set(["", "image", "video", "link"]);
  const errors = [];

  if (!allowed.has(techniqueMediaType)) {
    errors.push("techniqueMediaType must be image, video, link, or empty");
  }
  if (techniqueMediaUrl && !/^https?:\/\//i.test(techniqueMediaUrl)) {
    errors.push("techniqueMediaUrl must start with http:// or https://");
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { techniqueMediaType, techniqueMediaUrl } };
}
