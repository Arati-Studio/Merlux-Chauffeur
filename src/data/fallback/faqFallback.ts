export interface FallbackFAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  active: boolean;
  updatedAt?: any;
}

export const faqFallback: FallbackFAQ[] = [
  {
    "id": "faq1",
    "updatedAt": {
      "type": "firestore/timestamp/1.0",
      "seconds": 1779432108,
      "nanoseconds": 599000000
    },
    "category": "General",
    "question": "What services does Merlux Chauffeur offer?",
    "order": 0,
    "active": true,
    "answer": "Merlux Chauffeur provides a range of luxury private transfer services, including airport transfers, executive and corporate hire, special event transfers, private tours, and point-to-point transfers across Melbourne."
  },
  {
    "id": "faq2",
    "order": 1,
    "question": "How can I book a Merlux Chauffeur service?",
    "active": true,
    "answer": "You can book online through the Book A Ride form, by phone, or via email. Booking is available 24/7.",
    "updatedAt": {
      "type": "firestore/timestamp/1.0",
      "seconds": 1779432108,
      "nanoseconds": 599000000
    },
    "category": "Booking"
  },
  {
    "id": "faq3",
    "category": "Booking",
    "updatedAt": {
      "type": "firestore/timestamp/1.0",
      "seconds": 1779432108,
      "nanoseconds": 599000000
    },
    "active": true,
    "answer": "Advance booking is recommended, but last-minute bookings are accepted subject to availability.",
    "order": 2,
    "question": "Is there a minimum notice period for booking a chauffeur?"
  },
  {
    "id": "faq4",
    "category": "Booking",
    "updatedAt": {
      "type": "firestore/timestamp/1.0",
      "seconds": 1779432108,
      "nanoseconds": 599000000
    },
    "active": true,
    "answer": "Yes, you can modify or cancel your booking. Please refer to the cancellation policy for terms.",
    "order": 3,
    "question": "Can I modify or cancel my booking?"
  },
  {
    "id": "faq5",
    "active": true,
    "answer": "Yes, we offer corporate accounts with priority service, streamlined booking, and billing options.",
    "question": "Do you offer corporate or executive accounts?",
    "order": 4,
    "category": "Corporate",
    "updatedAt": {
      "type": "firestore/timestamp/1.0",
      "seconds": 1779432108,
      "nanoseconds": 599000000
    }
  },
  {
    "id": "faq6",
    "updatedAt": {
      "type": "firestore/timestamp/1.0",
      "seconds": 1779432108,
      "nanoseconds": 599000000
    },
    "category": "Payments",
    "order": 5,
    "question": "How is the price of my ride calculated?",
    "active": true,
    "answer": "Pricing depends on vehicle type, distance, transfer type, and travel time."
  },
  {
    "id": "faq7",
    "updatedAt": {
      "type": "firestore/timestamp/1.0",
      "seconds": 1779432108,
      "nanoseconds": 599000000
    },
    "category": "Payments",
    "question": "Do you have transparent pricing, or are there hidden fees?",
    "order": 6,
    "answer": "We offer transparent pricing with no hidden fees. The quoted price is final.",
    "active": true
  },
  {
    "id": "faq8",
    "active": true,
    "answer": "We accept Visa, Mastercard, Amex, and bank transfers for corporate clients.",
    "question": "What forms of payment do you accept?",
    "order": 7,
    "category": "Payments",
    "updatedAt": {
      "type": "firestore/timestamp/1.0",
      "seconds": 1779432108,
      "nanoseconds": 599000000
    }
  },
  {
    "id": "faq9",
    "answer": "Payment is required at the time of booking unless you have a corporate account.",
    "active": true,
    "order": 8,
    "question": "When is payment required for a booking?",
    "category": "Payments",
    "updatedAt": {
      "type": "firestore/timestamp/1.0",
      "seconds": 1779432108,
      "nanoseconds": 599000000
    }
  },
  {
    "id": "faq10",
    "category": "Payments",
    "updatedAt": {
      "type": "firestore/timestamp/1.0",
      "seconds": 1779432108,
      "nanoseconds": 599000000
    },
    "active": true,
    "answer": "No, gratuity is optional and not included in the fare.",
    "question": "Is gratuity included in the fare?",
    "order": 9
  },
  {
    "id": "faq11",
    "order": 10,
    "question": "Which airports do you service in Melbourne?",
    "answer": "We service Melbourne Airport, Avalon Airport, and private jet terminals.",
    "active": true,
    "updatedAt": {
      "type": "firestore/timestamp/1.0",
      "seconds": 1779432108,
      "nanoseconds": 599000000
    },
    "category": "Airport"
  },
  {
    "id": "faq12",
    "active": true,
    "answer": "Your chauffeur will meet you inside the terminal with a personalised name sign.",
    "order": 11,
    "question": "How will I find my chauffeur at the airport?",
    "category": "Airport",
    "updatedAt": {
      "type": "firestore/timestamp/1.0",
      "seconds": 1779432108,
      "nanoseconds": 599000000
    }
  },
  {
    "id": "faq13",
    "updatedAt": {
      "type": "firestore/timestamp/1.0",
      "seconds": 1779432108,
      "nanoseconds": 599000000
    },
    "category": "Airport",
    "order": 12,
    "question": "Do you track my flight in case of delays?",
    "active": true,
    "answer": "Yes, we monitor flights in real-time and adjust pickup times accordingly."
  },
  {
    "id": "faq14",
    "active": true,
    "answer": "We provide complimentary waiting time for delays within a reasonable period.",
    "question": "Is there a charge if my flight is delayed?",
    "order": 13,
    "category": "Airport",
    "updatedAt": {
      "type": "firestore/timestamp/1.0",
      "seconds": 1779432108,
      "nanoseconds": 599000000
    }
  },
  {
    "id": "faq15",
    "category": "Safety",
    "updatedAt": {
      "type": "firestore/timestamp/1.0",
      "seconds": 1779432108,
      "nanoseconds": 599000000
    },
    "answer": "Yes, all chauffeurs are highly trained, experienced, and certified professionals.",
    "active": true,
    "question": "Are your chauffeurs professionally certified?",
    "order": 14
  },
  {
    "id": "faq16",
    "answer": "We ensure regular vehicle maintenance, compliance with regulations, and licensed chauffeurs.",
    "active": true,
    "question": "What safety measures are in place for passengers?",
    "order": 15,
    "category": "Safety",
    "updatedAt": {
      "type": "firestore/timestamp/1.0",
      "seconds": 1779432108,
      "nanoseconds": 599000000
    }
  },
  {
    "id": "faq17",
    "category": "Booking",
    "updatedAt": {
      "type": "firestore/timestamp/1.0",
      "seconds": 1779432108,
      "nanoseconds": 599000000
    },
    "active": true,
    "answer": "Yes, you can request a chauffeur based on availability.",
    "question": "Can I request a specific chauffeur for my ride?",
    "order": 16
  },
  {
    "id": "faq18",
    "active": true,
    "answer": "Our fleet includes Mercedes S-Class, E-Class, GLE SUVs, and V-Class vans.",
    "order": 17,
    "question": "What type of vehicles are in the Merlux fleet?",
    "category": "Fleet",
    "updatedAt": {
      "type": "firestore/timestamp/1.0",
      "seconds": 1779432108,
      "nanoseconds": 599000000
    }
  },
  {
    "id": "faq19",
    "question": "How many passengers can each vehicle accommodate?",
    "order": 18,
    "answer": "Sedans: 2–4 passengers, SUVs: up to 4, Vans: up to 7 passengers.",
    "active": true,
    "updatedAt": {
      "type": "firestore/timestamp/1.0",
      "seconds": 1779432108,
      "nanoseconds": 599000000
    },
    "category": "Fleet"
  },
  {
    "id": "faq20",
    "order": 19,
    "question": "Are child seats available?",
    "active": true,
    "answer": "Yes, child and booster seats are available upon request.",
    "updatedAt": {
      "type": "firestore/timestamp/1.0",
      "seconds": 1779432108,
      "nanoseconds": 599000000
    },
    "category": "Fleet"
  },
  {
    "id": "faq21",
    "order": 20,
    "question": "Is smoking permitted in your vehicles?",
    "active": true,
    "answer": "No, all vehicles are strictly non-smoking.",
    "updatedAt": {
      "type": "firestore/timestamp/1.0",
      "seconds": 1779432108,
      "nanoseconds": 599000000
    },
    "category": "Safety"
  },
  {
    "id": "faq22",
    "updatedAt": {
      "type": "firestore/timestamp/1.0",
      "seconds": 1779432108,
      "nanoseconds": 599000000
    },
    "category": "Fleet",
    "order": 21,
    "question": "Can I request special amenities, such as water or specific music?",
    "active": true,
    "answer": "Yes, we provide bottled water and allow special requests during booking."
  },
  {
    "id": "faq23",
    "updatedAt": {
      "type": "firestore/timestamp/1.0",
      "seconds": 1779432108,
      "nanoseconds": 599000000
    },
    "category": "General",
    "question": "Do you offer services outside of the main Melbourne CBD area?",
    "order": 22,
    "active": true,
    "answer": "Yes, we service greater Melbourne and surrounding regions."
  },
  {
    "id": "faq24",
    "updatedAt": {
      "type": "firestore/timestamp/1.0",
      "seconds": 1779432108,
      "nanoseconds": 599000000
    },
    "category": "General",
    "order": 23,
    "question": "What happens if I leave an item in one of your vehicles?",
    "answer": "Contact us immediately with ride details and we will assist in locating your item.",
    "active": true
  },
  {
    "id": "faq25",
    "order": 24,
    "question": "How can I provide feedback about my Merlux Chauffeur experience?",
    "active": true,
    "answer": "You can provide feedback via our Contact Us page or leave a review online.",
    "updatedAt": {
      "type": "firestore/timestamp/1.0",
      "seconds": 1779432108,
      "nanoseconds": 599000000
    },
    "category": "General"
  }
];
