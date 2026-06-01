import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  recipients: string[];
  active: boolean;
  event: string;
}

export interface EmailSettings {
  enabled: boolean;
  adminEmail: string;
}

export const emailService = {
  async getSettings(): Promise<EmailSettings | null> {
    const snap = await getDoc(doc(db, 'settings', 'email'));
    return snap.exists() ? (snap.data() as EmailSettings) : null;
  },

  async getTemplate(event: string): Promise<EmailTemplate | null> {
    const q = query(collection(db, 'email-templates'), where('event', '==', event), where('active', '==', true));
    const snap = await getDocs(q);
    return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() } as EmailTemplate;
  },

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  async sendEmail(to: string | string[], subject: string, html: string) {
    if (!to || (Array.isArray(to) && to.length === 0)) return { success: false, error: 'No recipient email provided' };
    
    // Check if any provided emails are valid
    const emails = Array.isArray(to) ? to : [to];
    const validEmails = emails.filter(this.isValidEmail);
    if (validEmails.length === 0) {
      return { 
        success: false, 
        error: `Invalid email format for all recipients.` 
      };
    }

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: validEmails, subject, html })
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to send Email:', error);
      return { success: false, error };
    }
  },

  async notify(eventName: string, data: any, ignoreGlobalDisabled: boolean = false) {
    const settings = await this.getSettings();
    if (!ignoreGlobalDisabled && !settings?.enabled) {
      console.log('Email notifications are disabled globally');
      return;
    }

    const template = await this.getTemplate(eventName);
    if (!template) {
      console.log(`No active Email template found for event: ${eventName}`);
      return;
    }

    // Enrich driver/vehicle information if vehicleId exists
    const enrichedData = { ...data };
    let siteUrl = '';
    if (typeof window !== 'undefined') {
      siteUrl = window.location.origin;
    } else if (process.env.VITE_SITE_URL) {
      siteUrl = process.env.VITE_SITE_URL;
    } else {
      siteUrl = 'https://merlux.au';
    }
    if (siteUrl.endsWith('/')) {
      siteUrl = siteUrl.slice(0, -1);
    }
    enrichedData.siteUrl = siteUrl;
    enrichedData.rateUrl = `${siteUrl}/payment/success?booking_id=${enrichedData.id || enrichedData.bookingId || data.id || ''}&rate=true`;
    if (!enrichedData.bookingId) enrichedData.bookingId = enrichedData.id || '';
    if (!enrichedData.id) enrichedData.id = enrichedData.bookingId || '';
    if (enrichedData.vehicleId) {
      try {
        const vehicleDoc = await getDoc(doc(db, 'fleet', enrichedData.vehicleId));
        if (vehicleDoc.exists()) {
          const vData = vehicleDoc.data();
          const fleetName = `${vData.name || ''} ${vData.model || ''}`.trim() || vData.name || '';
          const fleetPlate = vData.plateNo || '';
          enrichedData.driverVehicle = fleetName;
          enrichedData.driverPlate = fleetPlate;
          enrichedData.vehicleName = fleetName;
          enrichedData.vehiclePlate = fleetPlate;
          enrichedData.fleetName = fleetName;
          enrichedData.fleetPlate = fleetPlate;
        }
      } catch (err) {
        console.error('Error enriching vehicle details for Email notification:', err);
      }
    }

    if (enrichedData.driverId && (!enrichedData.driverName || !enrichedData.driverPhone || !enrichedData.driverEmail)) {
      try {
        const driverDoc = await getDoc(doc(db, 'users', enrichedData.driverId));
        if (driverDoc.exists()) {
          const drData = driverDoc.data();
          if (!enrichedData.driverName) enrichedData.driverName = drData.name || '';
          if (!enrichedData.driverPhone) enrichedData.driverPhone = drData.phone || '';
          if (!enrichedData.driverEmail) enrichedData.driverEmail = drData.email || '';
        }
      } catch (err) {
        console.error('Error enriching driver details for Email notification:', err);
      }
    }

    let subject = template.subject;
    let htmlContent = template.content;
    
    // Process conditional wrapping blocks first
    Object.keys(enrichedData).forEach(key => {
      const val = enrichedData[key];
      const hasValue = val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== '0' && String(val).trim() !== '0.00' && String(val).trim() !== 'N/A' && String(val).trim() !== 'N/A at N/A';
      const ifRegex = new RegExp(`\\{if:${key}\\}([\\s\\S]*?)\\{\\/if:${key}\\}`, 'g');
      if (hasValue) {
        htmlContent = htmlContent.replace(ifRegex, '$1');
      } else {
        htmlContent = htmlContent.replace(ifRegex, '');
      }
    });

    // Cleanup any extra or nested unresolved standard if blocks
    htmlContent = htmlContent.replace(/\{if:\w+\}[\s\S]*?\{\/if:\w+\}/g, '');

    // Basic placeholder replacement for subject and content
    Object.keys(enrichedData).forEach(key => {
      const value = enrichedData[key] || '';
      const regex = new RegExp(`{${key}}`, 'g');
      subject = subject.replace(regex, String(value));
      htmlContent = htmlContent.replace(regex, String(value));
    });

    const promises = [];

    // Handle recipients
    if (template.recipients.includes('customer') && data.customerEmail) {
      promises.push(this.sendEmail(data.customerEmail, subject, htmlContent));
    }

    if (template.recipients.includes('admin') && settings.adminEmail) {
      promises.push(this.sendEmail(settings.adminEmail, subject, htmlContent));
    }
    
    if (template.recipients.includes('driver') && data.driverEmail) { // driverEmail might need to be resolved correctly from data or driver object
      promises.push(this.sendEmail(data.driverEmail, subject, htmlContent));
    }

    await Promise.all(promises);
  }
};
