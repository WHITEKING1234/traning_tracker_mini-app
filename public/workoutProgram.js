const REST_SECONDS = {
  compound: 120,
  accessory: 90,
  small: 60,
};

const CYRILLIC_TO_LATIN = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "c",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

export function normalizeExerciseKey(name) {
  return String(name)
    .trim()
    .toLocaleLowerCase("ru-RU")
    .normalize("NFC")
    .replace(/[а-яё]/giu, (letter) => CYRILLIC_TO_LATIN[letter.toLocaleLowerCase("ru-RU")] ?? "")
    .replace(/[^a-z0-9]+/giu, "-")
    .replace(/^-|-$/g, "");
}

function exercise(id, name, category) {
  return {
    id,
    name,
    exerciseKey: normalizeExerciseKey(name),
    category,
    defaultRestSeconds: REST_SECONDS[category],
  };
}

export const WORKOUT_DAYS = [
  {
    id: "monday",
    weekday: 1,
    title: "Понедельник",
    exercises: [
      exercise("monday-bench-press", "Жим штанги лёжа", "compound"),
      exercise("monday-lat-pulldown", "Тяга верхнего блока", "compound"),
      exercise("monday-leg-press", "Жим ногами", "compound"),
      exercise("monday-seated-cable-row", "Тяга горизонтального блока", "compound"),
      exercise("monday-dumbbell-fly", "Разводка гантелей", "accessory"),
      exercise("monday-lying-leg-curl", "Сгибание ног лёжа", "accessory"),
      exercise("monday-dumbbell-biceps-curl", "Подъём гантелей на бицепс", "accessory"),
      exercise("monday-cable-triceps-pushdown", "Разгибание рук на блоке", "accessory"),
      exercise("monday-abs", "Пресс", "small"),
    ],
  },
  {
    id: "wednesday",
    weekday: 3,
    title: "Среда",
    exercises: [
      exercise("wednesday-barbell-squat", "Приседания со штангой", "compound"),
      exercise("wednesday-seated-dumbbell-shoulder-press", "Жим гантелей сидя", "compound"),
      exercise("wednesday-lat-pulldown", "Тяга верхнего блока", "compound"),
      exercise("wednesday-romanian-deadlift", "Румынская тяга", "compound"),
      exercise("wednesday-dumbbell-lateral-raise", "Разведения гантелей в стороны", "accessory"),
      exercise("wednesday-seated-cable-row", "Тяга горизонтального блока", "compound"),
      exercise("wednesday-lying-leg-curl", "Сгибание ног лёжа", "accessory"),
      exercise("wednesday-hammer-curl", "Молотки", "accessory"),
      exercise("wednesday-french-press", "Французский жим", "accessory"),
    ],
  },
  {
    id: "friday",
    weekday: 5,
    title: "Пятница",
    exercises: [
      exercise("friday-incline-dumbbell-press", "Жим гантелей на наклонной скамье", "compound"),
      exercise("friday-t-bar-row", "Тяга Т-грифа", "compound"),
      exercise("friday-leg-extension", "Разгибание ног", "accessory"),
      exercise("friday-machine-chest-press", "Жим в тренажёре", "compound"),
      exercise("friday-close-grip-lat-pulldown", "Тяга верхнего блока узким хватом", "compound"),
      exercise("friday-dumbbell-lateral-raise", "Разведения гантелей в стороны", "accessory"),
      exercise("friday-scott-bench-curl", "Сгибание рук на скамье Скотта", "accessory"),
      exercise("friday-cable-triceps-pushdown", "Разгибание рук на блоке", "accessory"),
      exercise("friday-standing-calf-raise", "Подъём на носки стоя", "small"),
    ],
  },
];

export function getWorkoutForWeekday(weekday) {
  return WORKOUT_DAYS.find((day) => day.weekday === weekday) ?? WORKOUT_DAYS[0];
}

export function getWorkoutById(workoutDayId) {
  return WORKOUT_DAYS.find((day) => day.id === workoutDayId);
}

export function getExerciseById(exerciseId) {
  for (const day of WORKOUT_DAYS) {
    const match = day.exercises.find((item) => item.id === exerciseId);
    if (match) return { ...match, workoutDayId: day.id, workoutDayTitle: day.title };
  }
  return undefined;
}

export function getAllExercises() {
  return WORKOUT_DAYS.flatMap((day) =>
    day.exercises.map((item, index) => ({
      ...item,
      workoutDayId: day.id,
      workoutDayTitle: day.title,
      sortOrder: index + 1,
    })),
  );
}
