const RAPID_API_KEY = import.meta.env.VITE_FLIGHT_API_KEY || "";
const RAPID_API_HOST = "aerodatabox.p.rapidapi.com";

const AUSTRALIAN_AIRPORTS = [
  "SYD", // Sydney
  "MEL", // Melbourne
  "BNE", // Brisbane
  "PER", // Perth
  "ADL", // Adelaide
  "CBR", // Canberra
  "OOL", // Gold Coast
  "DRW", // Darwin
  "HBA", // Hobart
  "CNS", // Cairns
  // Add more as needed
];

export interface FlightStatus {
  flightNumber: string;
  status: string;
  airlineName?: string;
  departureAirport: string;
  departureAirportName?: string;
  departureTimeZone?: string;
  scheduledDeparture: string;
  estimatedDeparture?: string;
  actualDeparture?: string;
  arrivalAirport: string;
  arrivalAirportName?: string;
  arrivalTimeZone?: string;
  scheduledArrival: string;
  estimatedArrival?: string;
  actualArrival?: string;
  delayMinutes?: number;
  terminal?: string;
  gate?: string;
  lastUpdated?: string;
}

export async function fetchFlightStatus(
  flightNumber: string,
  date: string,
): Promise<FlightStatus | null> {
  if (!RAPID_API_KEY) {
    console.warn(
      "Flight API key is missing. Please set VITE_FLIGHT_API_KEY in your environment.",
    );
    return null;
  }

  try {
    // AeroDataBox expects flight number and date (YYYY-MM-DD)
    const response = await fetch(
      `https://${RAPID_API_HOST}/flights/number/${flightNumber}/${date}?withStatus=true`,
      {
        method: "GET",
        headers: {
          "x-rapidapi-key": RAPID_API_KEY,
          "x-rapidapi-host": RAPID_API_HOST,
        },
      },
    );

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Flight API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data || !Array.isArray(data) || data.length === 0) return null;

    // Get departure from the first leg, arrival from the last leg
    const firstFlight = data[0]; // Departure details
    const lastFlight = data[data.length - 1]; // Arrival details
    const departure = firstFlight.departure;
    const arrival = lastFlight.arrival;

    // Extract airport codes
    const departureAirport = departure?.airport?.iata || "";
    const arrivalAirport = arrival?.airport?.iata || "";

    // Restrict to flights involving Australia (incoming or outgoing)
    const isAustralianFlight =
      AUSTRALIAN_AIRPORTS.includes(departureAirport) ||
      AUSTRALIAN_AIRPORTS.includes(arrivalAirport);
    if (!isAustralianFlight) {
      console.warn(
        "Flight does not involve Australian airports. Only Australian flights are supported.",
      );
      return null; // This will trigger the "Could not find flight information" message
    }

    return {
      flightNumber: firstFlight.number,
      status: lastFlight.status || "Unknown",
      airlineName: lastFlight.airline?.name || firstFlight.airline?.name || "",
      departureAirport,
      departureAirportName: departure?.airport?.name || "",
      departureTimeZone: departure?.timeZone || departure?.timezone || "",
      scheduledDeparture: departure?.scheduledTime?.local || "",
      estimatedDeparture: departure?.estimatedTime?.local,
      actualDeparture: departure?.actualTime?.local,
      arrivalAirport,
      arrivalAirportName: arrival?.airport?.name || "",
      arrivalTimeZone: arrival?.timeZone || arrival?.timezone || "",
      scheduledArrival: arrival?.scheduledTime?.local || "",
      estimatedArrival: arrival?.estimatedTime?.local,
      actualArrival: arrival?.actualTime?.local,
      delayMinutes: arrival?.delayMinutes || 0,
      terminal: arrival?.terminal,
      gate: arrival?.gate,
      lastUpdated:
        lastFlight.statusUpdate?.time ||
        lastFlight.updatedAt ||
        lastFlight.lastUpdated ||
        undefined,
    };
  } catch (error) {
    console.error("Error fetching flight status:", error);
    return null;
  }
}
