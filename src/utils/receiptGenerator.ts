import { jsPDF } from 'jspdf';

interface BookingData {
  id: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  date: string;
  time: string;
  pickup: string;
  dropoff?: string;
  price: string | number;
  paymentMethod?: string;
  paymentStatus?: string;
  vehicleType?: string;
  vehicleId?: string;
  serviceType?: string;
  duration?: string;
  distance?: string;
  hours?: string | number;
  isReturn?: boolean;
  returnDate?: string;
  returnTime?: string;
  selectedExtras?: any;
  flightNumber?: string;
  notes?: string;
  purpose?: string;
  status?: string;
}

/**
 * Generates and downloads a luxury-styled PDF receipt for past bookings
 */
export function downloadReceiptPDF(booking: BookingData, fleetList: any[] = [], extrasList: any[] = []) {
  // Initialize A4 document (210mm x 297mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Color Palette (Luxury Charcoal and Warm Gold)
  const colors = {
    darkBg: [10, 10, 10], // #0A0A0A
    gold: [212, 175, 55],  // #D4AF37
    goldLight: [244, 235, 204],
    textDark: [30, 30, 30],
    textMuted: [110, 110, 110],
    lightBg: [248, 248, 248],
    border: [230, 230, 230],
    white: [255, 255, 255]
  };

  // Helper: Draw horizontal line
  const drawLine = (y: number, color: number[] = colors.border, thickness: number = 0.2) => {
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(thickness);
    doc.line(15, y, 195, y);
  };

  // 1. Header Banner (Luxury Dark Mode header block)
  doc.setFillColor(colors.darkBg[0], colors.darkBg[1], colors.darkBg[2]);
  doc.rect(0, 0, 210, 45, 'F');

  // Merlux Logo
  doc.setTextColor(colors.gold[0], colors.gold[1], colors.gold[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text('M E R L U X', 15, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text('MELBOURNE\'S PREMIER CHAUFFEUR SERVICE', 15, 25);

  // Right Side: Tax Invoice text
  doc.setTextColor(colors.gold[0], colors.gold[1], colors.gold[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('TAX INVOICE / RECEIPT', 195, 20, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(220, 220, 220);
  doc.text(`Receipt Reference: #${booking.id.substring(0, 8).toUpperCase()}`, 195, 26, { align: 'right' });
  doc.text(`Date of Issue: ${new Date().toLocaleDateString('en-AU')}`, 195, 31, { align: 'right' });

  // Elegant divider underneath dark header
  doc.setFillColor(colors.gold[0], colors.gold[1], colors.gold[2]);
  doc.rect(0, 45, 210, 1.5, 'F');

  // Y position tracker
  let y = 58;

  // 2. Customer & Ride Summary Block (Two Column Grid)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(colors.darkBg[0], colors.darkBg[1], colors.darkBg[2]);
  doc.text('PASSENGER DETAILS', 15, y);
  doc.text('TRIP INFORMATION', 110, y);

  y += 4;
  drawLine(y, colors.darkBg, 0.4);
  y += 6;

  // Passenger Data
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.text(booking.customerName || 'Merlux Chauffeur Guest', 15, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  doc.text(`Email: ${booking.customerEmail || 'N/A'}`, 15, y + 5);
  doc.text(`Phone: ${booking.customerPhone || 'N/A'}`, 15, y + 10);

  // Vehicle Information
  const vehicleName = fleetList.find(v => v.id === booking.vehicleId || v.name === booking.vehicleType)?.name || booking.vehicleType || 'Executive Sedan';
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.text(`Vehicle: ${vehicleName}`, 110, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  
  const serviceText = booking.serviceType ? booking.serviceType.toUpperCase() : 'STANDARD RIDE';
  doc.text(`Service Type: ${serviceText}`, 110, y + 5);
  
  const durationText = booking.serviceType === 'hourly' 
    ? `${booking.hours} Hours` 
    : (booking.duration || 'Standard');
  doc.text(`Duration: ${durationText}`, 110, y + 10);

  y += 18;

  // 3. Journey Details Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(colors.darkBg[0], colors.darkBg[1], colors.darkBg[2]);
  doc.text('JOURNEY DETAILS', 15, y);
  
  y += 4;
  drawLine(y, colors.darkBg, 0.4);
  y += 6;

  // Booking Date & Time
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.text(`Scheduled Date: ${booking.date} at ${booking.time}`, 15, y);

  if (booking.isReturn && booking.returnDate) {
    doc.text(`Return Date: ${booking.returnDate} at ${booking.returnTime || ''}`, 110, y);
  }

  y += 7;

  // Addresses rendering (using splitTextToSize to handle long addresses beautifully)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(colors.gold[0], colors.gold[1], colors.gold[2]);
  doc.text('Pickup Location:', 15, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  const pickupLines = doc.splitTextToSize(booking.pickup, 75);
  doc.text(pickupLines, 15, y + 4.5);

  // Dropoff Address
  const dropoffVal = booking.dropoff || (booking.serviceType === 'hourly' ? 'Optional (Hourly Charter)' : 'N/A');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(colors.gold[0], colors.gold[1], colors.gold[2]);
  doc.text('Drop-off Location:', 110, y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  const dropoffLines = doc.splitTextToSize(dropoffVal, 75);
  doc.text(dropoffLines, 110, y + 4.5);

  // Measure max height of address texts to advance y correctly
  const maxAddressHeight = Math.max(pickupLines.length, dropoffLines.length) * 4.5 + 8;
  y += maxAddressHeight;

  // flight info or notes if they exist
  if (booking.flightNumber || booking.notes || booking.purpose) {
    drawLine(y, colors.border, 0.2);
    y += 5;
    if (booking.flightNumber) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`Flight Details: `, 15, y);
      doc.setFont('helvetica', 'normal');
      doc.text(booking.flightNumber.toUpperCase(), 38, y);
    }
    const noteText = booking.purpose || booking.notes;
    if (noteText) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`Special Notes: `, 110, y);
      doc.setFont('helvetica', 'normal');
      const noteLines = doc.splitTextToSize(`"${noteText}"`, 65);
      doc.text(noteLines, 134, y);
      // increment y for multi-line notes if necessary
      y += (noteLines.length - 1) * 4.5;
    }
    y += 6;
  }

  y += 4;

  // 4. Financial breakdown table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(colors.darkBg[0], colors.darkBg[1], colors.darkBg[2]);
  doc.text('FARE BREAKDOWN & CHARGES', 15, y);

  y += 4;
  drawLine(y, colors.darkBg, 0.4);
  y += 4;

  // Table header background
  doc.setFillColor(colors.lightBg[0], colors.lightBg[1], colors.lightBg[2]);
  doc.rect(15, y, 180, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.text('Description', 18, y + 5);
  doc.text('Unit Price', 125, y + 5, { align: 'right' });
  doc.text('Quantity', 155, y + 5, { align: 'right' });
  doc.text('Total Amount', 192, y + 5, { align: 'right' });

  y += 7;

  // Calculate base vs extras pricing
  const basePrice = Number(booking.price) || 0;
  
  // Base Service row
  drawLine(y, colors.border, 0.1);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  
  const descText = `${vehicleName} - Chauffeur Drive (${booking.date})`;
  doc.text(descText, 18, y + 5);
  doc.text(`$${basePrice.toFixed(2)}`, 125, y + 5, { align: 'right' });
  doc.text('1', 155, y + 5, { align: 'right' });
  doc.text(`$${basePrice.toFixed(2)}`, 192, y + 5, { align: 'right' });

  y += 8;

  // Selected extras rendering if any
  if (booking.selectedExtras) {
    const extrasObj = booking.selectedExtras;
    const hasExtras = Array.isArray(extrasObj) ? extrasObj.length > 0 : Object.keys(extrasObj || {}).length > 0;

    if (hasExtras) {
      if (Array.isArray(extrasObj)) {
        extrasObj.forEach((id: string) => {
          const extra = extrasList.find(e => e.id === id);
          if (extra) {
            drawLine(y, colors.border, 0.1);
            doc.text(`• Add-on: ${extra.name || 'Additional Amenity'}`, 18, y + 5);
            doc.text(`Included`, 125, y + 5, { align: 'right' });
            doc.text('1', 155, y + 5, { align: 'right' });
            doc.text(`$0.00`, 192, y + 5, { align: 'right' });
            y += 8;
          }
        });
      } else {
        Object.entries(extrasObj).forEach(([id, count]) => {
          const extra = extrasList.find(e => e.id === id);
          if (extra) {
            drawLine(y, colors.border, 0.1);
            const extraPrice = Number(extra.price || 0);
            const lineTotal = extraPrice * (count as number);
            doc.text(`• Add-on: ${extra.name || id}`, 18, y + 5);
            doc.text(`$${extraPrice.toFixed(2)}`, 125, y + 5, { align: 'right' });
            doc.text(`${count}`, 155, y + 5, { align: 'right' });
            doc.text(`$${lineTotal.toFixed(2)}`, 192, y + 5, { align: 'right' });
            y += 8;
          }
        });
      }
    }
  }

  drawLine(y, colors.darkBg, 0.3);
  y += 2;

  // Total Summary Panel (Right Aligned)
  const finalTotal = basePrice; // if extras are calculated inside base, or custom addition is needed
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  doc.text('Subtotal:', 145, y + 5, { align: 'right' });
  doc.text(`$${(finalTotal / 1.1).toFixed(2)}`, 192, y + 5, { align: 'right' });

  y += 5.5;

  doc.text('GST Included (10%):', 145, y + 5, { align: 'right' });
  doc.text(`$${(finalTotal - finalTotal / 1.1).toFixed(2)}`, 192, y + 5, { align: 'right' });

  y += 6;

  // Highlighted Grand Total Box
  doc.setFillColor(colors.goldLight[0], colors.goldLight[1], colors.goldLight[2]);
  doc.rect(115, y, 80, 9, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.text('GRAND TOTAL (AUD):', 118, y + 6);
  doc.text(`$${finalTotal.toFixed(2)}`, 192, y + 6, { align: 'right' });

  y += 16;

  // 5. Payment status & Method detail block
  doc.setFillColor(250, 250, 250);
  doc.rect(15, y, 180, 16, 'F');
  doc.setDrawColor(235, 235, 235);
  doc.rect(15, y, 180, 16, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  
  const pMethod = booking.paymentMethod ? booking.paymentMethod.toUpperCase() : 'CREDIT CARD (STRIPE)';
  doc.text(`PAYMENT METHOD: ${pMethod}`, 20, y + 6.5);
  
  const pStatus = booking.paymentStatus ? booking.paymentStatus.toUpperCase() : 'PAID';
  doc.setTextColor(pStatus === 'PAID' ? 46 : colors.textDark[0], pStatus === 'PAID' ? 125 : colors.textDark[1], pStatus === 'PAID' ? 50 : colors.textDark[2]);
  doc.text(`PAYMENT STATUS: ${pStatus}`, 20, y + 11.5);

  // Little paid stamp on the right side if paid
  if (pStatus === 'PAID' || booking.status === 'completed') {
    doc.setDrawColor(46, 125, 50);
    doc.setLineWidth(0.4);
    doc.setFillColor(235, 245, 235);
    doc.rect(150, y + 2.5, 38, 11, 'FD');
    doc.setTextColor(46, 125, 50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('SUCCESSFULLY PAID', 169, y + 9.5, { align: 'center' });
  }

  // 6. Support & Professional Footer
  y = 262;
  drawLine(y, colors.gold, 0.4);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(colors.darkBg[0], colors.darkBg[1], colors.darkBg[2]);
  doc.text('THANK YOU FOR YOUR PATRONAGE', 105, y, { align: 'center' });

  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(colors.textMuted[0], colors.textMuted[1], colors.textMuted[2]);
  doc.text('This is an official transaction record from Merlux Chauffeur Melbourne.', 105, y, { align: 'center' });
  
  y += 4;
  doc.text('For amendments, claims, or client support: support@merlux.com.au | Phone: +61 3 9000 0000', 105, y, { align: 'center' });

  // Save the PDF file
  const filename = `Merlux_Receipt_${booking.id.substring(0, 8).toUpperCase()}.pdf`;
  doc.save(filename);
}
