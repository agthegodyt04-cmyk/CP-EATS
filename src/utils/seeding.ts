import { collection, getDocs, doc, writeBatch, setDoc, db } from "../db";
import { KitchenDetails, MenuItem, FeedPost } from "../types";

// Creative SVG Food Placeholders (fully offline, CSS-stylable, highly vibrant)
const PANEER_MASALA_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450" viewBox="0 0 600 450"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23FF5722" /><stop offset="100%" stop-color="%23FF9800" /></linearGradient></defs><rect width="100%" height="100%" fill="url(%23g1)" /><circle cx="300" cy="200" r="140" fill="%234E1A0C" opacity="0.3"/><circle cx="300" cy="190" r="130" fill="%235C1F0E"/><circle cx="300" cy="190" r="115" fill="%239E2B0E"/><path d="M220,190 Q300,300 380,190 Z" fill="%23D84315"/><circle cx="250" cy="150" r="20" fill="%23FFCC80" rx="4" ry="4"/><circle cx="320" cy="140" r="15" fill="%23FFCC80"/><circle cx="350" cy="210" r="25" fill="%23FFCC80"/><circle cx="260" cy="220" r="18" fill="%23FFCC80"/><path d="M 280,110 Q 300,90 320,110 Q 330,130 310,140 Z" fill="%2381C784" opacity="0.8"/><text x="300" y="380" font-family="system-ui, sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle">Simran's Butter Paneer</text><text x="300" y="410" font-family="system-ui, sans-serif" font-size="16" fill="%23FFE082" text-anchor="middle">Freshly Spiced Punjabi Gravy</text></svg>`;

const DOSA_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450" viewBox="0 0 600 450"><defs><linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%238D6E63" /><stop offset="100%" stop-color="%234E342E" /></linearGradient></defs><rect width="100%" height="100%" fill="url(%23g2)" /><circle cx="300" cy="180" r="130" fill="%233E2723"/><path d="M 170,220 L 430,120 L 410,100 L 150,200 Z" fill="%23D7CCC8" opacity="0.5"/><path d="M 160,210 L 420,110 L 400,90 L 140,190 Z" fill="%23A1887F"/><circle cx="240" cy="260" r="35" fill="%23E0F2F1"/><circle cx="240" cy="260" r="25" fill="%23009688" opacity="0.3"/><circle cx="360" cy="260" r="35" fill="%23FFFDE7"/><circle cx="360" cy="260" r="25" fill="%23FBC02D" opacity="0.4"/><text x="300" y="380" font-family="system-ui, sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle">Auntie's Ghee Podi Dosa</text><text x="300" y="410" font-family="system-ui, sans-serif" font-size="16" fill="%23B2DFDB" text-anchor="middle">Served with Sambhar & Coconut Chutney</text></svg>`;

const CAKE_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450" viewBox="0 0 600 450"><defs><linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23EC407A" /><stop offset="100%" stop-color="%23AD1457" /></linearGradient></defs><rect width="100%" height="100%" fill="url(%23g3)" /><ellipse cx="300" cy="240" rx="140" ry="60" fill="%233F0C20"/><rect x="160" y="150" width="280" height="90" fill="%235C1331"/><ellipse cx="300" cy="150" rx="140" ry="60" fill="%23880E4F"/><ellipse cx="300" cy="140" rx="130" ry="50" fill="%23D81B60"/><circle cx="300" cy="110" r="15" fill="%23E91E63"/><path d="M 290,110 Q 300,90 310,110" stroke="%23333" stroke-width="4" fill="none"/><text x="300" y="380" font-family="system-ui, sans-serif" font-size="28" font-weight="bold" fill="white" text-anchor="middle">Decadent Velvet Cupcakes</text><text x="300" y="410" font-family="system-ui, sans-serif" font-size="16" fill="%23F8BBD0" text-anchor="middle">100% Eggless Homemade Confections</text></svg>`;

export async function seedInitialData() {
  try {
    const kitchensSnap = await getDocs(collection(db, "kitchens"));
    if (!kitchensSnap.empty) {
      console.log("Database already initialized with kitchens. Skipping seed.");
      return;
    }
  } catch (err) {
    console.error("Seed check failed:", err);
    return;
  }

  console.log("Starting DB initialization seeding...");

    // 1. Kitchens
    const mockKitchens: KitchenDetails[] = [
      {
        uid: "kitchen_punjabi_tadka",
        kitchenName: "Simran's Punjabi Tadka",
        handle: "simrans-punjabi-tadka",
        profileImageUrl: "",
        vegType: "both",
        mov: 150,
        isOnline: true,
        restingUntil: null,
        operatingMode: "online",
        cuisineType: "North Indian, Punjabi Delicacies",
        society: "Centurian Park - O2 Valley",
        flatAddress: "Centurian Park - O2 Valley, Tower F-18, Floor 4, Flat 04",
        securityPin: "1234"
      },
      {
        uid: "kitchen_south_tiffin",
        kitchenName: "Auntie's South Indian Tiffin",
        handle: "aunties-south-indian-tiffin",
        profileImageUrl: "",
        vegType: "veg",
        mov: 100,
        isOnline: true,
        restingUntil: null,
        operatingMode: "online",
        cuisineType: "South Indian, Fresh Idli & Dosa",
        society: "Centurian Park - Low Rise",
        flatAddress: "Centurian Park - Low Rise, Tower C1, Floor 3, Flat 02",
        securityPin: "1234"
      },
      {
        uid: "kitchen_sweet_oven",
        kitchenName: "The Sweet Oven",
        handle: "the-sweet-oven",
        profileImageUrl: "",
        vegType: "veg",
        mov: 120,
        isOnline: true,
        restingUntil: null,
        operatingMode: "online",
        cuisineType: "Eggless Desserts & Bakery",
        society: "Centurian Park - Tropical Garden",
        flatAddress: "Centurian Park - Tropical Garden, Tower F2, Floor 18, Flat 05",
        securityPin: "1234"
      }
    ];

    // Seed kitchen user profiles
    const mockKitchenProfiles = [
      {
        uid: "kitchen_punjabi_tadka",
        email: "simran@cpeats.com",
        displayName: "Simran's Punjabi Tadka",
        handle: "simrans-punjabi-tadka",
        profileImageUrl: "",
        role: "kitchen",
        phone: "+91 98765 43210",
        society: "Centurian Park - O2 Valley",
        flatAddress: "Centurian Park - O2 Valley, Tower F-18, Floor 4, Flat 04",
        myGateId: "MG-VALLEY-F18-0404",
        status: "verified",
        securityPin: "1234",
        createdAt: Date.now()
      },
      {
        uid: "kitchen_south_tiffin",
        email: "auntie@cpeats.com",
        displayName: "Auntie's South Indian Tiffin",
        handle: "aunties-south-indian-tiffin",
        profileImageUrl: "",
        role: "kitchen",
        phone: "+91 99887 76655",
        society: "Centurian Park - Low Rise",
        flatAddress: "Centurian Park - Low Rise, Tower C1, Floor 3, Flat 02",
        myGateId: "MG-LOWRISE-C1-0302",
        status: "verified",
        securityPin: "1234",
        createdAt: Date.now()
      },
      {
        uid: "kitchen_sweet_oven",
        email: "priya@cpeats.com",
        displayName: "The Sweet Oven",
        handle: "the-sweet-oven",
        profileImageUrl: "",
        role: "kitchen",
        phone: "+91 91234 56789",
        society: "Centurian Park - Tropical Garden",
        flatAddress: "Centurian Park - Tropical Garden, Tower F2, Floor 18, Flat 05",
        myGateId: "MG-TROPICAL-F2-1805",
        status: "verified",
        securityPin: "1234",
        createdAt: Date.now()
      }
    ];

    // 2. Menu Items
    const mockMenuItems: MenuItem[] = [
      // Simran's Punjabi Tadka
      {
        id: "menu_p1",
        kitchenId: "kitchen_punjabi_tadka",
        name: "Paneer Butter Masala",
        description: "Soft cottage cheese cubes in rich, velvety tomato and cream butter gravy",
        price: 180,
        isVeg: true,
        isAvailable: true,
        category: "Main Course",
        createdAt: Date.now()
      },
      {
        id: "menu_p2",
        kitchenId: "kitchen_punjabi_tadka",
        name: "Butter Roti (1 pc)",
        description: "Tandoori style whole wheat roti loaded with butter",
        price: 20,
        isVeg: true,
        isAvailable: true,
        category: "Breads",
        createdAt: Date.now()
      },
      {
        id: "menu_p3",
        kitchenId: "kitchen_punjabi_tadka",
        name: "Kadai Chicken",
        description: "Tender chicken pieces cooked in a spicy gravy with bell peppers and freshly ground spices",
        price: 240,
        isVeg: false,
        isAvailable: true,
        category: "Main Course",
        createdAt: Date.now()
      },
      // Auntie's South Indian Tiffin
      {
        id: "menu_s1",
        kitchenId: "kitchen_south_tiffin",
        name: "Ghee Podi Masala Dosa",
        description: "Crispy rice crepe sprinkled with aromatic gun powder (podi) and clarified butter (ghee), stuffed with potato masala",
        price: 110,
        isVeg: true,
        isAvailable: true,
        category: "Dosa Specials",
        createdAt: Date.now()
      },
      {
        id: "menu_s2",
        kitchenId: "kitchen_south_tiffin",
        name: "Steamed Idli (2 pcs)",
        description: "Soft, fluffy steamed rice cakes served with hot lentil sambar and authentic coconut chutney",
        price: 60,
        isVeg: true,
        isAvailable: true,
        category: "Breakfast Tiffin",
        createdAt: Date.now()
      },
      {
        id: "menu_s3",
        kitchenId: "kitchen_south_tiffin",
        name: "Crispy Medu Vada (2 pcs)",
        description: "Crispy golden fried lentil donuts with a soft interior",
        price: 70,
        isVeg: true,
        isAvailable: true,
        category: "Breakfast Tiffin",
        createdAt: Date.now()
      },
      // The Sweet Oven
      {
        id: "menu_sw1",
        kitchenId: "kitchen_sweet_oven",
        name: "Eggless Chocolate Velvet Cupcakes (Box of 2)",
        description: "Luxurious cocoa infused sponge topped with rich dark chocolate whipped ganache. 100% eggless.",
        price: 120,
        isVeg: true,
        isAvailable: true,
        category: "Cupcakes",
        createdAt: Date.now()
      },
      {
        id: "menu_sw2",
        kitchenId: "kitchen_sweet_oven",
        name: "Fresh Strawberry Pastry",
        description: "Light vanilla sponge loaded with fresh seasonal Mahabaleshwar strawberry slices and whipped cream",
        price: 90,
        isVeg: true,
        isAvailable: true,
        category: "Pastries",
        createdAt: Date.now()
      }
    ];

    // 3. Feed Posts
    const mockFeedPosts: FeedPost[] = [
      {
        id: "post_punjabi_1",
        kitchenId: "kitchen_punjabi_tadka",
        kitchenName: "Simran's Punjabi Tadka",
        description: "Simmering a fresh batch of Butter Paneer for tonight's dinner! The kitchen smells absolutely divine. Pair it with our hand-stretched hot butter rotis. Order cutoff at 7:00 PM!",
        imageUrl: PANEER_MASALA_SVG,
        likes: ["demo_user_1", "demo_user_2"],
        taggedItemIds: ["menu_p1"],
        createdAt: Date.now() - 3600000 // 1 hour ago
      },
      {
        id: "post_south_1",
        kitchenId: "kitchen_south_tiffin",
        kitchenName: "Auntie's South Indian Tiffin",
        description: "Sundays are meant for Podi Dosa! Freshly ground gun powder podi, roasted on heavy cast iron with organic cold-pressed ghee. Crispy, golden, and pure comfort. Available till 11:30 AM only!",
        imageUrl: DOSA_SVG,
        likes: ["demo_user_1"],
        taggedItemIds: ["menu_s1"],
        createdAt: Date.now() - 7200000 // 2 hours ago
      },
      {
        id: "post_sweet_1",
        kitchenId: "kitchen_sweet_oven",
        kitchenName: "The Sweet Oven",
        description: "Baked with love! Just pulled these gorgeous, ultra-moist eggless chocolate velvet cupcakes out of the oven. Perfectly frosted and ready to sweeten your weekend. Limited batches available!",
        imageUrl: CAKE_SVG,
        likes: ["demo_user_2", "demo_user_3"],
        taggedItemIds: ["menu_sw1"],
        createdAt: Date.now() - 10800000 // 3 hours ago
      }
    ];

    // Save Kitchens (strip the app-only `uid`; Supabase uses the `id` column)
    for (const kitchen of mockKitchens) {
      const { uid, ...kitchenFields } = kitchen as any;
      await setDoc(doc(db, "kitchens", uid), kitchenFields);
    }

    // Save Profiles (strip `uid`; Supabase `users` uses `id`)
    for (const profile of mockKitchenProfiles) {
      const { uid, ...profileFields } = profile as any;
      await setDoc(doc(db, "users", uid), profileFields);
    }

    // Save Menu Items
    for (const item of mockMenuItems) {
      const docRef = doc(db, "menu_items", item.id);
      await setDoc(docRef, item);
    }

    // Save Feed Posts
    for (const post of mockFeedPosts) {
      const docRef = doc(db, "feed_posts", post.id);
      await setDoc(docRef, post);
    }

    console.log("Database initialized and seeded successfully!");
}
