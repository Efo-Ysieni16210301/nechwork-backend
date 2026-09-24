import "dotenv/config";
import mongoose from "mongoose";
import Article from "./models/Article";
import Product from "./models/Product";

const articles = [
  {
    name: "ethiopian-coffee",
    title: "Ethiopian Coffee: The Birthplace of Coffee",
    content: [
      "Ethiopia is widely regarded as the birthplace of coffee, with legend tracing its discovery to a goat herder named Kaldi in the Kaffa region, who noticed his goats becoming unusually energetic after eating berries from a certain shrub. From there, the practice of brewing coffee spread across the Arab world and eventually the globe, but Ethiopia remains the only place where coffee still grows wild in forest ecosystems.",
      "The country's varied climate and altitude produce a remarkable diversity of flavor profiles across its growing regions. Yirgacheffe is famous for bright, floral, and citrusy notes, Sidamo offers winey and fruity characteristics, Harar beans are known for their bold, almost blueberry-like sweetness, and Limu produces a balanced, mildly spiced cup. This regional diversity is one of the reasons Ethiopian coffee is prized by specialty roasters worldwide.",
      "Coffee is deeply woven into Ethiopian identity and daily life, most visibly through the traditional coffee ceremony, or 'buna,' which can last over an hour. Green beans are roasted over an open flame in front of guests, ground by hand, and brewed in a clay pot called a jebena, then served in small cups over three rounds, each believed to carry its own significance — the first round is considered the strongest and most important.",
      "Economically, coffee is Ethiopia's largest export and a cornerstone of its foreign currency earnings, supporting an estimated 15 million people who depend on the coffee value chain for their livelihoods, from smallholder farmers to processors and exporters. Ethiopia is also Africa's largest coffee producer and consistently ranks among the top five coffee-producing nations in the world.",
    ],
  },
  {
    name: "ethiopian-sesame-oil",
    title: "Ethiopian Sesame Oil: A Golden Export",
    content: [
      "Ethiopia is one of the world's leading producers and exporters of sesame seeds, a crop that thrives in the country's warm, semi-arid lowland regions. The Humera and Wollega zones in particular have become major agricultural hubs for sesame cultivation, benefiting from fertile soils and a climate well suited to the crop's needs.",
      "Sesame oil extracted from Ethiopian seeds is valued for its rich, nutty flavor and high oil content, making it a sought-after ingredient both for cooking and for traditional skincare and haircare preparations. Locally, sesame oil and paste are used in a variety of dishes, adding depth to sauces and stews, while the seeds themselves are toasted and incorporated into snacks and condiments.",
      "Beyond domestic use, sesame has become one of Ethiopia's most important cash crops for export, generating substantial foreign currency earnings for the country. Ethiopian sesame is particularly prized in international markets such as China, Israel, and countries across the Middle East, where its quality and oil yield are considered superior to sesame from many other origins.",
      "The sector plays a vital economic role for rural communities, providing income and employment for hundreds of thousands of smallholder farmers, seasonal laborers, and traders. However, the industry also faces challenges, including price volatility in global markets, logistical bottlenecks in transporting seeds from remote growing areas, and the need for continued investment in irrigation and modern farming techniques to boost yields.",
    ],
  },
  {
    name: "ethiopian-sugar",
    title: "Ethiopia's Sugar Industry: Growth and Challenges",
    content: [
      "Ethiopia has pursued an ambitious strategy to expand its domestic sugar production over the past two decades, viewing the sector as a key pillar of its broader industrialization and agricultural transformation goals. Large state-run sugar estates have been established along major river basins, particularly the Awash and Omo rivers, which provide the water resources necessary for sugarcane cultivation in Ethiopia's lowland areas.",
      "Flagship projects such as the Tendaho Sugar Factory in the Afar region and the multi-phase Kuraz Sugar Development Project in the South Omo Valley represent some of the largest agricultural investments in the country's history. These projects were designed not only to satisfy domestic sugar demand, which has historically relied heavily on imports, but also to eventually position Ethiopia as a net exporter of sugar and related products.",
      "The industry extends beyond raw sugar production, supporting downstream activities such as ethanol production for fuel blending and ethanol-based industries, as well as the generation of bagasse, a byproduct used for electricity generation and animal feed. This creates a broader value chain that contributes to rural employment and infrastructure development in otherwise underdeveloped regions.",
      "Despite this potential, Ethiopia's sugar sector has faced significant hurdles, including delayed project completions, cost overruns, financing difficulties, and infrastructure gaps such as inadequate transport links to move sugar from remote estates to processing and distribution centers. In recent years, the government has explored privatizing some sugar estates in an effort to attract foreign investment, improve efficiency, and accelerate the sector's long-term growth.",
    ],
  },
];

const products = [
  ["yirgacheffe", "Yirgacheffe single origin", "Coffee", "Bright citrus, jasmine and a honeyed finish.", 18, "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=85", "Bestseller"],
  ["house-blend", "House espresso blend", "Coffee", "A balanced, chocolatey daily cup with a silky body.", 16, "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=900&q=85"],
  ["mountain-tea", "Mountain breakfast tea", "Tea", "A fragrant black tea blend for slow mornings.", 14, "https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?auto=format&fit=crop&w=900&q=85", "New"],
  ["chai-spice", "Cardamom chai spice", "Tea", "Whole spices for a warm, aromatic cup at home.", 12, "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=900&q=85"],
  ["wildflower-honey", "Wildflower honey", "Pantry", "Raw, small-batch honey with floral Ethiopian notes.", 11, "https://images.unsplash.com/photo-1471943311424-646960669fbc?auto=format&fit=crop&w=900&q=85"],
  ["sesame-crunch", "Sesame crunch", "Pantry", "Toasted sesame brittle made with local cane sugar.", 9, "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=900&q=85"],
  ["ceramic-mug", "Hand-thrown stoneware mug", "Home & gifts", "A tactile, warm-grey mug made for your everyday ritual.", 28, "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=900&q=85"],
  ["morning-box", "The slow morning box", "Home & gifts", "Coffee, honey and a mug, thoughtfully packed for gifting.", 52, "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85", "Gift pick"],
].map(([id, name, category, description, price, image, badge]) => ({ id, name, category, description, price, image, ...(badge ? { badge } : {}) }));

async function seed() {
  await mongoose.connect(process.env.MONGO_URI as string);
  await Article.deleteMany({});
  await Article.insertMany(articles);
  await Product.deleteMany({});
  await Product.insertMany(products);
  console.log("Seeded articles and products!");
  await mongoose.disconnect();
}

seed();
