// Aktuelles Wetter am Startpunkt einer Strecke — via Open-Meteo (kostenlos,
// kein API-Key nötig, passt damit zum bestehenden Muster freier Datenquellen
// ohne eigene Zugangsdaten, siehe lib/elevation.ts/swisstopo). Bewusst nur
// der Startpunkt statt eines Profils entlang der ganzen Strecke — bei
// Alpenpässen oft mehrere Wetterzonen, aber "wie sieht's aktuell am Einstieg
// aus" ist die praktisch relevante Frage vor der Abfahrt.
export interface CurrentWeather {
  tempC: number;
  label: string;
}

// WMO-Wettercode (0–99) → kurzes deutsches Label, siehe
// https://open-meteo.com/en/docs (Feld "weather_code"). Bewusst grob
// zusammengefasst (z.B. leichter/starker Regen zusammen) — für eine knappe
// Statuszeile reicht die Kategorie, keine Detailmeldung nötig.
function weatherLabel(code: number): string {
  if (code === 0) return "Klar";
  if (code <= 2) return "Leicht bewölkt";
  if (code === 3) return "Bewölkt";
  if (code === 45 || code === 48) return "Nebel";
  if (code >= 51 && code <= 57) return "Nieselregen";
  if (code >= 61 && code <= 67) return "Regen";
  if (code >= 71 && code <= 77) return "Schneefall";
  if (code >= 80 && code <= 82) return "Regenschauer";
  if (code === 85 || code === 86) return "Schneeschauer";
  if (code >= 95) return "Gewitter";
  return "—";
}

export async function fetchCurrentWeather(
  [lon, lat]: [number, number],
): Promise<CurrentWeather | null> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`,
      // Kurzes Caching statt no-store: "aktuell" muss nicht auf die Minute
      // genau sein, spart aber wiederholte Aufrufe bei mehreren Aufrufen
      // derselben Strecke innerhalb kurzer Zeit.
      { next: { revalidate: 600 } },
    );
    if (!res.ok) return null;

    const data: { current?: { temperature_2m?: number; weather_code?: number } } =
      await res.json();
    if (data.current?.temperature_2m === undefined || data.current?.weather_code === undefined) {
      return null;
    }

    return {
      tempC: Math.round(data.current.temperature_2m),
      label: weatherLabel(data.current.weather_code),
    };
  } catch {
    return null;
  }
}
