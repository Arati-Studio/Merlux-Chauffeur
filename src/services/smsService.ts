import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface SMSTemplate {
  id: string;
  name: string;
  content: string;
  recipients: string[];
  active: boolean;
}

export interface SMSSettings {
  enabled: boolean;
  adminPhone: string;
}

export const smsService = {
  async getSettings(): Promise<SMSSettings | null> {
    const snap = await getDoc(doc(db, 'settings', 'sms'));
    return snap.exists() ? (snap.data() as SMSSettings) : null;
  },

  async getTemplate(event: string): Promise<SMSTemplate | null> {
    const q = query(collection(db, 'sms-templates'), where('event', '==', event), where('active', '==', true));
    const snap = await getDocs(q);
    return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() } as SMSTemplate;
  },

  isValidPhone(phone: string): boolean {
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phone);
  },

  async sendSMS(to: string, message: string) {
    if (!to) return { success: false, error: 'No recipient phone number provided' };
    if (!this.isValidPhone(to)) {
      return { 
        success: false, 
        error: `Invalid phone format: ${to}. Numbers must be in E.164 format (e.g., +1234567890).` 
      };
    }
    try {
      const response = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, message })
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to send SMS:', error);
      return { success: false, error };
    }
  },

  async notify(eventName: string, data: any, ignoreGlobalDisabled: boolean = false) {
    const settings = await this.getSettings();
    if (!ignoreGlobalDisabled && !settings?.enabled) {
      console.log('SMS notifications are disabled globally');
      return;
    }

    const template = await this.getTemplate(eventName);
    if (!template) {
      console.log(`No active SMS template found for event: ${eventName}`);
      return;
    }

    // Enrich driver/vehicle information if vehicleId exists
    const enrichedData = { ...data };
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
        console.error('Error enriching vehicle details for SMS notification:', err);
      }
    }

    if (enrichedData.driverId && (!enrichedData.driverName || !enrichedData.driverPhone)) {
      try {
        const driverDoc = await getDoc(doc(db, 'users', enrichedData.driverId));
        if (driverDoc.exists()) {
          const drData = driverDoc.data();
          if (!enrichedData.driverName) enrichedData.driverName = drData.name || '';
          if (!enrichedData.driverPhone) enrichedData.driverPhone = drData.phone || '';
          if (!enrichedData.driverEmail) enrichedData.driverEmail = drData.email || '';
        }
      } catch (err) {
        console.error('Error enriching driver details for SMS notification:', err);
      }
    }

    let message = template.content;
    
    // Process conditional wrapping blocks first
    Object.keys(enrichedData).forEach(key => {
      const val = enrichedData[key];
      const hasValue = val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== '0' && String(val).trim() !== '0.00' && String(val).trim() !== 'N/A';
      const ifRegex = new RegExp(`\\{if:${key}\\}([\\s\\S]*?)\\{\\/if:${key}\\}`, 'g');
      if (hasValue) {
        message = message.replace(ifRegex, '$1');
      } else {
        message = message.replace(ifRegex, '');
      }
    });

    // Cleanup any extra or nested unresolved standard if blocks
    message = message.replace(/\{if:\w+\}[\s\S]*?\{\/if:\w+\}/g, '');

    // Basic placeholder replacement
    Object.keys(enrichedData).forEach(key => {
      const value = enrichedData[key] || '';
      message = message.replace(new RegExp(`{${key}}`, 'g'), String(value));
    });

    const promises = [];

    // Handle recipients
    if (template.recipients.includes('customer') && data.customerPhone) {
      promises.push(this.sendSMS(data.customerPhone, message));
    }

    if (template.recipients.includes('admin') && settings.adminPhone) {
      promises.push(this.sendSMS(settings.adminPhone, message));
    }
    
    if (template.recipients.includes('driver') && data.driverPhone) {
      promises.push(this.sendSMS(data.driverPhone, message));
    }

    await Promise.all(promises);
  }
};
