import "dotenv/config";
import mongoose from "mongoose";
import Article from "./models/Article";
import Product from "./models/Product";
import { defaultProducts } from "./catalog";

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

async function seed() {
  await mongoose.connect(process.env.MONGO_URI as string);
  await Article.deleteMany({});
  await Article.insertMany(articles);
  await Product.deleteMany({});
  await Product.insertMany(defaultProducts);
  console.log("Seeded articles and products!");
  await mongoose.disconnect();
}

seed();
