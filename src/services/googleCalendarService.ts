import { GoogleAuthProvider, signInWithPopup, linkWithPopup, getAuth, reauthenticateWithPopup } from 'firebase/auth';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

// Load cached token from localStorage to survive page refreshes/reloads
let cachedAccessToken: string | null = typeof window !== 'undefined' ? localStorage.getItem('gcal_access_token') : null;

export function getCalendarAccessToken(): string | null {
  return cachedAccessToken;
}

export function setCalendarAccessToken(token: string | null) {
  cachedAccessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
       localStorage.setItem('gcal_access_token', token);
    } else {
       localStorage.removeItem('gcal_access_token');
    }
  }
}

export function handleUnauthorizedError() {
  console.warn('Google Calendar Access Token has expired or is invalid. Invalidating session state...');
  setCalendarAccessToken(null);
  
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('gcal_unauthorized'));
    
    // Also, update users profile in firestore to clear calendarLinked flag
    const currentUserId = currentAuth?.currentUser?.uid;
    if (currentUserId) {
      import('firebase/firestore').then(async ({ doc, updateDoc }) => {
        try {
          await updateDoc(doc(db, 'users', currentUserId), { calendarLinked: false });
        } catch (dbErr) {
          console.warn('Failed to clear calendarLinked from user profile during 401 response:', dbErr);
        }
      });
    }
  }
}

// Automatically discard Google Calendar access token when authenticating out of the system
const currentAuth = getAuth();
currentAuth.onAuthStateChanged((user) => {
  if (!user) {
    setCalendarAccessToken(null);
  }
});

/**
 * Sign in with Google and request Google Calendar scopes specifically.
 */
export async function googleSignInWithCalendar(expectedGmail?: string): Promise<string | null> {
  const currentAuth = getAuth();
  const provider = new GoogleAuthProvider();

  // Request full Google Calendar access
  provider.addScope('https://www.googleapis.com/auth/calendar');

  // Force consent prompt so the user can easily re-authorize and select their account on reconnect
  const customParams: any = {
    prompt: 'select_account consent'
  };
  if (expectedGmail) {
    customParams.login_hint = expectedGmail;
  }
  provider.setCustomParameters(customParams);

  try {
    let accessToken: string | null = null;
    let authUser: any = null;

    if (currentAuth.currentUser) {
      // Synchronously check if Google is already linked to avoid double-popup triggers
      const isGoogleLinked = currentAuth.currentUser.providerData.some(
        (p) => p.providerId === 'google.com'
      );

      if (isGoogleLinked) {
        console.log('Provider is already linked to this user, performing direct re-authentication to refresh Google Calendar scopes...');
        const result = await reauthenticateWithPopup(currentAuth.currentUser, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        accessToken = credential?.accessToken || null;
        authUser = result.user;
      } else {
        console.log('Provider not linked yet, performing direct linkWithPopup...');
        const result = await linkWithPopup(currentAuth.currentUser, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        accessToken = credential?.accessToken || null;
        authUser = result.user;
      }
    } else {
      // If not logged in, perform signInWithPopup
      const result = await signInWithPopup(currentAuth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      accessToken = credential?.accessToken || null;
      authUser = result.user;

      // Create user profile in Firestore if returning new
      const user = result.user;
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        const { setDoc, serverTimestamp } = await import('firebase/firestore');
        await setDoc(userRef, {
          id: user.uid,
          name: user.displayName || 'Google Chauffeur Guest',
          email: user.email,
          phone: '',
          address: '',
          role: 'customer',
          emailVerified: user.emailVerified || false,
          createdAt: serverTimestamp()
        });
      }
    }

    if (expectedGmail && authUser) {
      const googleProvider = authUser.providerData?.find((p: any) => p.providerId === 'google.com');
      const authEmail = googleProvider?.email || authUser.email || '';
      if (authEmail && authEmail.toLowerCase() !== expectedGmail.toLowerCase()) {
        throw new Error(`The authorized Google account (${authEmail}) does not match your linked Google Gmail (${expectedGmail}) from your profile settings.`);
      }
    }

    if (accessToken) {
      setCalendarAccessToken(accessToken);
      if (currentAuth.currentUser) {
        const userRef = doc(db, 'users', currentAuth.currentUser.uid);
        await updateDoc(userRef, { calendarLinked: true }).catch((err) => {
          console.warn('Could not update userProfile with calendarLinked flag:', err);
        });
      }
      return accessToken;
    }
    return null;
  } catch (error: any) {
    console.error('Google Auths Error:', error);
    if (error.code === 'auth/popup-blocked') {
      console.error('The browser blocked the Google authorization sign-in pop-up. Please ensure pop-ups are allowed for this site in your browser search bar, or try opening the preview in a new tab.');
    } else {
      console.error(error.message || 'Error connecting to Google Calendar');
    }
    throw error;
  }
}

/**
 * Format date and time string from booking into an ISO 8601 string for Google Calendar.
 */
function parseBookingDateTime(dateStr: string, timeStr: string, minutesToAdd = 0): string {
  try {
    if (!dateStr) return new Date().toISOString();

    // Parse time like "14:30" or "02:30 PM"
    let cleanTime = timeStr || '12:00';
    let hours = 12;
    let minutes = 0;

    if (cleanTime.toLowerCase().includes('am') || cleanTime.toLowerCase().includes('pm')) {
      const pm = cleanTime.toLowerCase().includes('pm');
      const parts = cleanTime.replace(/(am|pm)/i, '').trim().split(':');
      hours = parseInt(parts[0], 10);
      minutes = parts[1] ? parseInt(parts[1], 10) : 0;
      if (pm && hours < 12) hours += 12;
      if (!pm && hours === 12) hours = 0;
    } else {
      const parts = cleanTime.split(':');
      hours = parseInt(parts[0], 10) || 12;
      minutes = parseInt(parts[1], 10) || 0;
    }

    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day, hours, minutes);
    if (minutesToAdd > 0) {
      date.setMinutes(date.getMinutes() + minutesToAdd);
    }

    // Convert to timezone string or Local ISO without offset for ease
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
  } catch (e) {
    console.error('DateTime parse error:', e);
    return dateStr + 'T' + (timeStr || '12:00:00');
  }
}

/**
 * Creates or updates Google Calendar Event for a booking record.
 */
export async function syncBookingToCalendar(booking: any): Promise<boolean> {
  if (!cachedAccessToken) {
    console.log('No cached Google Access Token found, skipping auto-sync.');
    return false;
  }

  const currentUserId = currentAuth.currentUser?.uid;
  let isDriver = false;
  if (currentUserId) {
    try {
      const userSnap = await getDoc(doc(db, 'users', currentUserId));
      if (userSnap.exists()) {
        isDriver = userSnap.data().role === 'driver';
      }
    } catch (e) {
      console.warn('Error fetching role in syncBookingToCalendar:', e);
    }
  }

  // Role-based status filter: Driver only syncs 'accepted' rides.
  if (isDriver && booking.status !== 'accepted') {
    console.log(`Driver role active and booking status is ${booking.status} (not accepted). Auto-removing from Google Calendar...`);
    return await deleteBookingFromCalendar(booking);
  } else if (!isDriver && (booking.status === 'cancelled' || booking.status === 'rejected' || booking.status === 'completed')) {
    console.log(`Booking ${booking.id} is cancelled/rejected/completed. Auto-removing from Google Calendar...`);
    return await deleteBookingFromCalendar(booking);
  }

  try {
    const startDateTime = parseBookingDateTime(booking.date, booking.time);
    const endDateTime = parseBookingDateTime(booking.date, booking.time, 90); // default 1.5 Hour ride

    const currentUserId = currentAuth.currentUser?.uid;
    let finalEventId = currentUserId ? (booking.gcalEvents?.[currentUserId]?.eventId || null) : booking.calendarEventId;
    let isUpdate = !!finalEventId;

    if (!isUpdate) {
      try {
        console.log(`Checking for existing calendar event for booking ${booking.id} to avoid duplication...`);
        const searchUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?q=${booking.id}`;
        const searchRes = await fetch(searchUrl, {
          headers: { 'Authorization': `Bearer ${cachedAccessToken}` }
        });
        if (searchRes.status === 401) {
          handleUnauthorizedError();
          return false;
        }
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const matchedEvent = (searchData.items || []).find((event: any) => {
            const desc = event.description || '';
            const summ = event.summary || '';
            const hasBookingId = desc.includes(booking.id) || summ.includes(booking.id);
            const isReturn = desc.toLowerCase().includes('return') || summ.toLowerCase().includes('return');
            return hasBookingId && !isReturn;
          });
          if (matchedEvent) {
            console.log(`Matched existing calendar event with ID ${matchedEvent.id} for booking ${booking.id}. Overriding instead of duplicating.`);
            finalEventId = matchedEvent.id;
            isUpdate = true;
          }
        }
      } catch (searchErr) {
        console.warn('Error during duplicate event search:', searchErr);
      }
    }

    const url = isUpdate
      ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${finalEventId}`
      : 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

    const method = isUpdate ? 'PUT' : 'POST';

    const websiteUrl = `${window?.location?.origin || 'https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app'}/app`;
    const bookingStatus = (booking.status || 'pending').toUpperCase();

    // Fetch actual vehicle fleet name instead of ID
    let carFleetName = booking.vehicleType || booking.vehicleId || 'Premium Sedan';
    if (booking.vehicleId) {
      try {
        const vehicleDoc = await getDoc(doc(db, 'fleet', booking.vehicleId));
        if (vehicleDoc.exists()) {
          const vData = vehicleDoc.data();
          carFleetName = vData.name || vData.model || vData.vehicleType || carFleetName;
        }
      } catch (err) {
        console.warn('Error fetching vehicle details for calendar sync:', err);
      }
    }

    // Fetch assigned driver details
    let driverDetails: any = null;
    if (booking.driverId) {
      try {
        const driverSnap = await getDoc(doc(db, 'users', booking.driverId));
        if (driverSnap.exists()) {
          driverDetails = driverSnap.data();
        }
      } catch (err) {
        console.warn('Error fetching driver details for calendar sync:', err);
      }
    }

    const descriptionLines = [
      `Chauffeur Booking Reference Details`,
      `=========================`,
      `Booking Status: ${bookingStatus}`,
      `Client Profile: ${booking.customerName}`,
      `Contact Phone: ${booking.customerPhone || 'N/A'}`,
      `Contact Email: ${booking.customerEmail}`,
      `Service Segment: ${booking.serviceType || 'Standard'}`,
      `Car Fleet: ${carFleetName}`,
      `Journey Fare: $${booking.price || '0.00'}`,
      `=========================`,
      `🔗 Check Full Details: ${websiteUrl}`
    ];

    if (booking.additionalInfo || booking.notes) {
      descriptionLines.push(`Instructions & Remarks: ${booking.additionalInfo || booking.notes}`);
    }

    if (driverDetails) {
      descriptionLines.push(
        `=========================`,
        `Assigned Chauffeur Details`,
        `Chauffeur Name: ${driverDetails.name || 'N/A'}`,
        `Contact Phone: ${driverDetails.phone || 'N/A'}`,
        `Contact Email: ${driverDetails.email || 'N/A'}`
      );
    }

    const eventBody = {
      summary: `✨ [${bookingStatus}] Chauffeur Ride: ${booking.customerName} (Ref: ${booking.id?.substring(0, 6) || ''})`,
      location: `${booking.pickup} ${booking.dropoff ? 'to ' + booking.dropoff : ''}`,
      description: descriptionLines.join('\n'),
      start: {
        dateTime: startDateTime,
        timeZone: 'Australia/Melbourne'
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'Australia/Melbourne'
      },
      status: 'confirmed',
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 60 },
          { method: 'email', minutes: 120 }
        ]
      }
    };

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${cachedAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventBody)
    });

    if (!response.ok) {
      if (response.status === 401) {
        handleUnauthorizedError();
        return false;
      }
      const errText = await response.text();
      console.error('Google Calendar API Error: ', errText);

      // If event was deleted manually or not found on update, fallback to creating a new one
      if (isUpdate && response.status === 404) {
        console.log('Event expired or was not found. Attempting creation from scratch.');
        const clearRef = doc(db, 'bookings', booking.id);
        const updatePayload: any = {};
        if (currentUserId) {
          updatePayload[`gcalEvents.${currentUserId}.eventId`] = null;
        } else {
          updatePayload.calendarEventId = null;
        }
        await updateDoc(clearRef, updatePayload);
        const nextBooking = { ...booking };
        if (currentUserId) {
          if (!nextBooking.gcalEvents) nextBooking.gcalEvents = {};
          nextBooking.gcalEvents[currentUserId] = { ...nextBooking.gcalEvents[currentUserId], eventId: null };
        } else {
          nextBooking.calendarEventId = null;
        }
        return await syncBookingToCalendar(nextBooking);
      }
      return false;
    }

    const result = await response.json();
    const updatePayload: any = {
      syncedToCalendarAt: new Date().toISOString()
    };
    if (result.id) {
      if (currentUserId) {
        updatePayload[`gcalEvents.${currentUserId}.eventId`] = result.id;
        updatePayload[`gcalEvents.${currentUserId}.syncedAt`] = new Date().toISOString();
      } else {
        updatePayload.calendarEventId = result.id;
      }
    }
    const bookingRef = doc(db, 'bookings', booking.id);
    await updateDoc(bookingRef, updatePayload);

    // Also check if return trip is scheduled! Sync return trip as a separate event if enabled
    if (booking.returnDate && booking.returnTime) {
      await syncReturnTripToCalendar(booking);
    }

    return true;
  } catch (error) {
    console.error('Error syncing booking to calendar:', error);
    return false;
  }
}

/**
 * Handle sync for return trips as separate events securely
 */
async function syncReturnTripToCalendar(booking: any): Promise<boolean> {
  try {
    const startDateTime = parseBookingDateTime(booking.returnDate, booking.returnTime);
    const endDateTime = parseBookingDateTime(booking.returnDate, booking.returnTime, 90);

    const currentUserId = currentAuth.currentUser?.uid;
    let finalReturnEventId = currentUserId ? (booking.gcalEvents?.[currentUserId]?.returnEventId || null) : booking.returnCalendarEventId;
    let isUpdate = !!finalReturnEventId;

    if (!isUpdate) {
      try {
        console.log(`Checking for existing return calendar event for booking ${booking.id} to avoid duplication...`);
        const searchUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?q=${booking.id}`;
        const searchRes = await fetch(searchUrl, {
          headers: { 'Authorization': `Bearer ${cachedAccessToken}` }
        });
        if (searchRes.status === 401) {
          handleUnauthorizedError();
          return false;
        }
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const matchedEvent = (searchData.items || []).find((event: any) => {
            const desc = event.description || '';
            const summ = event.summary || '';
            const hasBookingId = desc.includes(booking.id) || summ.includes(booking.id);
            const isReturn = desc.toLowerCase().includes('return') || summ.toLowerCase().includes('return');
            return hasBookingId && isReturn;
          });
          if (matchedEvent) {
            console.log(`Matched existing return calendar event with ID ${matchedEvent.id} for booking ${booking.id}. Overriding instead of duplicating.`);
            finalReturnEventId = matchedEvent.id;
            isUpdate = true;
          }
        }
      } catch (searchErr) {
        console.warn('Error during duplicate return event search:', searchErr);
      }
    }

    const url = isUpdate
      ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${finalReturnEventId}`
      : 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

    const method = isUpdate ? 'PUT' : 'POST';

    const websiteUrl = `${window?.location?.origin || 'https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app'}/app`;
    const bookingStatus = (booking.status || 'pending').toUpperCase();

    // Fetch actual vehicle fleet name instead of ID
    let carFleetName = booking.vehicleType || booking.vehicleId || 'Premium Sedan';
    if (booking.vehicleId) {
      try {
        const vehicleDoc = await getDoc(doc(db, 'fleet', booking.vehicleId));
        if (vehicleDoc.exists()) {
          const vData = vehicleDoc.data();
          carFleetName = vData.name || vData.model || vData.vehicleType || carFleetName;
        }
      } catch (err) {
        console.warn('Error fetching vehicle details for calendar sync:', err);
      }
    }

    // Fetch assigned driver details
    let driverDetails: any = null;
    if (booking.driverId) {
      try {
        const driverSnap = await getDoc(doc(db, 'users', booking.driverId));
        if (driverSnap.exists()) {
          driverDetails = driverSnap.data();
        }
      } catch (err) {
        console.warn('Error fetching driver details for calendar sync:', err);
      }
    }

    const descriptionLines = [
      `✈️ RETURN Chauffeur Ride Reference`,
      `=========================`,
      `Booking Status: ${bookingStatus}`,
      `Client Profile: ${booking.customerName}`,
      `Contact Phone: ${booking.customerPhone || 'N/A'}`,
      `Contact Email: ${booking.customerEmail}`,
      `Service Segment: ${booking.serviceType || 'Standard'} (Return Trip)`,
      `Car Fleet: ${carFleetName}`,
      `=========================`,
      `🔗 Check Full Details: ${websiteUrl}`
    ];

    if (driverDetails) {
      descriptionLines.push(
        `=========================`,
        `Assigned Chauffeur Details`,
        `Chauffeur Name: ${driverDetails.name || 'N/A'}`,
        `Contact Phone: ${driverDetails.phone || 'N/A'}`,
        `Contact Email: ${driverDetails.email || 'N/A'}`
      );
    }

    const eventBody = {
      summary: `✨ [${bookingStatus}] Return Ride: ${booking.customerName} (Ref: ${booking.id?.substring(0, 6) || ''})`,
      status: 'confirmed',
      location: `${booking.dropoff} to ${booking.pickup}`, // reversed for return
      description: descriptionLines.join('\n'),
      start: {
        dateTime: startDateTime,
        timeZone: 'Australia/Melbourne'
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'Australia/Melbourne'
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 60 },
          { method: 'email', minutes: 120 }
        ]
      }
    };

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${cachedAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventBody)
    });

    if (!response.ok) {
      if (response.status === 401) {
        handleUnauthorizedError();
      }
      return false;
    }

    if (response.ok) {
      const result = await response.json();
      const updatePayload: any = {
        returnSyncedToCalendarAt: new Date().toISOString()
      };
      if (result.id) {
        if (currentUserId) {
          updatePayload[`gcalEvents.${currentUserId}.returnEventId`] = result.id;
          updatePayload[`gcalEvents.${currentUserId}.returnSyncedAt`] = new Date().toISOString();
        } else {
          updatePayload.returnCalendarEventId = result.id;
        }
      }
      const bookingRef = doc(db, 'bookings', booking.id);
      await updateDoc(bookingRef, updatePayload);
      return true;
    }
    return false;
  } catch (err) {
    console.error('Return trip sync failed:', err);
    return false;
  }
}

/**
 * Removes Google Calendar event when a booking is deleted or forcefully unsynced.
 */
export async function deleteBookingFromCalendar(booking: any): Promise<boolean> {
  if (!cachedAccessToken) return false;

  const currentUserId = currentAuth.currentUser?.uid;
  const eventId = currentUserId ? (booking.gcalEvents?.[currentUserId]?.eventId || null) : booking.calendarEventId;
  const returnEventId = currentUserId ? (booking.gcalEvents?.[currentUserId]?.returnEventId || null) : booking.returnCalendarEventId;

  try {
    let success = true;

    if (eventId) {
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${cachedAccessToken}` }
      });
      if (res.status === 401) {
        handleUnauthorizedError();
        return false;
      }
      success = success && (res.ok || res.status === 404 || res.status === 410);
    }

    if (returnEventId) {
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${returnEventId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${cachedAccessToken}` }
      });
      if (res.status === 401) {
        handleUnauthorizedError();
        return false;
      }
      success = success && (res.ok || res.status === 404 || res.status === 410);
    }

    // Always clear database fields on deletion attempt to avoid duplicate/dangling keys
    const bookingRef = doc(db, 'bookings', booking.id);
    const updatePayload: any = {};
    if (currentUserId) {
      updatePayload[`gcalEvents.${currentUserId}.eventId`] = null;
      updatePayload[`gcalEvents.${currentUserId}.returnEventId`] = null;
      updatePayload[`gcalEvents.${currentUserId}.syncedAt`] = null;
      updatePayload[`gcalEvents.${currentUserId}.returnSyncedAt`] = null;
    } else {
      updatePayload.calendarEventId = null;
      updatePayload.returnCalendarEventId = null;
      updatePayload.syncedToCalendarAt = null;
      updatePayload.returnSyncedToCalendarAt = null;
    }
    await updateDoc(bookingRef, updatePayload);

    return success;
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    // Even if fetch throws, let's attempt to clear the database keys so we don't get stuck in a bad state
    try {
      const bookingRef = doc(db, 'bookings', booking.id);
      const updatePayload: any = {};
      if (currentUserId) {
        updatePayload[`gcalEvents.${currentUserId}.eventId`] = null;
        updatePayload[`gcalEvents.${currentUserId}.returnEventId`] = null;
        updatePayload[`gcalEvents.${currentUserId}.syncedAt`] = null;
        updatePayload[`gcalEvents.${currentUserId}.returnSyncedAt`] = null;
      } else {
        updatePayload.calendarEventId = null;
        updatePayload.returnCalendarEventId = null;
        updatePayload.syncedToCalendarAt = null;
        updatePayload.returnSyncedToCalendarAt = null;
      }
      await updateDoc(bookingRef, updatePayload);
    } catch (e) {
      console.error('Failed to clear keys from Firestore:', e);
    }
    return false;
  }
}
