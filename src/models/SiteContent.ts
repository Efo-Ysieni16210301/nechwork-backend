import mongoose, { Document, Schema } from "mongoose";

export interface ISiteContent extends Document {
  key: string;
  brandName: string;
  brandLogoUrl: string;
  announcementText: string;
  homeEyebrow: string;
  homeTitle: string;
  homeEmphasis: string;
  homeLead: string;
  homeImageOne: string;
  homeImageTwo: string;
  homeImageThree: string;
  homeRitualEyebrow: string;
  homeRitualTitle: string;
  homeRitualAction: string;
  homeFeaturedEyebrow: string;
  homeFeaturedTitle: string;
  homeCategoryEyebrow: string;
  homeCategoryTitle: string;
  homeOriginEyebrow: string;
  homeOriginTitle: string;
  homeTrustEyebrow: string;
  homeTrustTitle: string;
  homeTrustBody: string;
  homeProcessEyebrow: string;
  homeProcessTitle: string;
  homeProcessStepOneTitle: string;
  homeProcessStepOneBody: string;
  homeProcessStepTwoTitle: string;
  homeProcessStepTwoBody: string;
  homeProcessStepThreeTitle: string;
  homeProcessStepThreeBody: string;
  homeNewsletterEyebrow: string;
  homeNewsletterTitle: string;
  homeNewsletterBody: string;
  aboutTitle: string;
  aboutLead: string;
  aboutStoryHeading: string;
  aboutStoryBody: string;
  aboutCoverageHeading: string;
  aboutCoverageBody: string;
  aboutMethodHeading: string;
  aboutMethodBody: string;
  footerTitle: string;
  footerText: string;
  contactEmail: string;
  contactOffices: string;
  telegramUsername: string;
  shopVideoUrl: string;
  shopVideoTitle: string;
  shopVideoCategory: string;
}

const SiteContentSchema = new Schema<ISiteContent>(
  {
    key: { type: String, required: true, unique: true, default: "main" },
    brandName: { type: String, required: true, trim: true, default: "Nech Work", maxlength: 80 },
    brandLogoUrl: { type: String, trim: true, default: "" },
    announcementText: { type: String, required: true, trim: true, default: "Freshly chosen goods, delivered across Ethiopia · Free delivery on orders over 2,500 ETB", maxlength: 250 },
    homeEyebrow: { type: String, required: true, trim: true, default: "Thoughtfully sourced in Ethiopia", maxlength: 120 },
    homeTitle: { type: String, required: true, trim: true, default: "Find something", maxlength: 120 },
    homeEmphasis: { type: String, required: true, trim: true, default: "worth savoring.", maxlength: 120 },
    homeLead: { type: String, required: true, trim: true, default: "Coffee, tea, pantry goods, and everyday objects from people who care deeply about making good things.", maxlength: 500 },
    homeImageOne: { type: String, required: true, trim: true, default: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1400&q=85", maxlength: 1000 },
    homeImageTwo: { type: String, required: true, trim: true, default: "https://images.unsplash.com/photo-1498804103079-a6351b050096?auto=format&fit=crop&w=1400&q=85", maxlength: 1000 },
    homeImageThree: { type: String, required: true, trim: true, default: "https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1400&q=85", maxlength: 1000 },
    homeRitualEyebrow: { type: String, required: true, trim: true, default: "Not sure where to start?", maxlength: 120 },
    homeRitualTitle: { type: String, required: true, trim: true, default: "Tell us what you like. We’ll help you find your next favorite.", maxlength: 250 },
    homeRitualAction: { type: String, required: true, trim: true, default: "Explore your taste →", maxlength: 100 },
    homeFeaturedEyebrow: { type: String, required: true, trim: true, default: "A few favourites", maxlength: 120 },
    homeFeaturedTitle: { type: String, required: true, trim: true, default: "Made for your ritual", maxlength: 150 },
    homeCategoryEyebrow: { type: String, required: true, trim: true, default: "Explore by mood", maxlength: 120 },
    homeCategoryTitle: { type: String, required: true, trim: true, default: "There’s always more to discover.", maxlength: 150 },
    homeOriginEyebrow: { type: String, required: true, trim: true, default: "From near and far", maxlength: 120 },
    homeOriginTitle: { type: String, required: true, trim: true, default: "Products with a place to tell.", maxlength: 150 },
    homeTrustEyebrow: { type: String, required: true, trim: true, default: "Made for real life", maxlength: 120 },
    homeTrustTitle: { type: String, required: true, trim: true, default: "Good products are better when people can count on them.", maxlength: 200 },
    homeTrustBody: { type: String, required: true, trim: true, default: "We keep listening, tasting, and improving so every order feels considered, useful, and worth sharing.", maxlength: 500 },
    homeProcessEyebrow: { type: String, required: true, trim: true, default: "The Nech Work way", maxlength: 120 },
    homeProcessTitle: { type: String, required: true, trim: true, default: "Good things, made easy.", maxlength: 150 },
    homeProcessStepOneTitle: { type: String, required: true, trim: true, default: "Choose with confidence", maxlength: 150 },
    homeProcessStepOneBody: { type: String, required: true, trim: true, default: "Clear notes, honest descriptions, and a collection that gets better every season.", maxlength: 500 },
    homeProcessStepTwoTitle: { type: String, required: true, trim: true, default: "We pack with care", maxlength: 150 },
    homeProcessStepTwoBody: { type: String, required: true, trim: true, default: "Every order is prepared by hand and ready to make an ordinary day feel special.", maxlength: 500 },
    homeProcessStepThreeTitle: { type: String, required: true, trim: true, default: "Enjoy the ritual", maxlength: 150 },
    homeProcessStepThreeBody: { type: String, required: true, trim: true, default: "Make time for the little things. We’ll keep bringing you more to discover.", maxlength: 500 },
    homeNewsletterEyebrow: { type: String, required: true, trim: true, default: "A note from Nech Work", maxlength: 120 },
    homeNewsletterTitle: { type: String, required: true, trim: true, default: "Good things, in your inbox.", maxlength: 150 },
    homeNewsletterBody: { type: String, required: true, trim: true, default: "New arrivals, thoughtful stories, and occasional offers. No noise, just the good stuff.", maxlength: 500 },
    aboutTitle: { type: String, required: true, trim: true, default: "About Nech Work", maxlength: 120 },
    aboutLead: { type: String, required: true, trim: true, default: "Nech Work is a considered collection of everyday goods, gathered from makers and growers who care deeply about their craft.", maxlength: 1000 },
    aboutStoryHeading: { type: String, required: true, trim: true, default: "Why we started this", maxlength: 120 },
    aboutStoryBody: { type: String, required: true, trim: true, default: "We started with a simple belief: the things we use every day should feel good to live with. From highland coffee and fragrant tea to pantry staples and hand-thrown homeware, each piece has a clear origin and a human story.", maxlength: 2000 },
    aboutCoverageHeading: { type: String, required: true, trim: true, default: "What we cover", maxlength: 120 },
    aboutCoverageBody: { type: String, required: true, trim: true, default: "Thoughtful coffee, tea, pantry goods, homeware, and gifts. We keep our collection small so we can know the people behind the products and make room for new discoveries.", maxlength: 2000 },
    aboutMethodHeading: { type: String, required: true, trim: true, default: "How we work", maxlength: 120 },
    aboutMethodBody: { type: String, required: true, trim: true, default: "We work directly with small producers wherever we can, pay fair prices, and choose materials and packaging with a lighter footprint. Good design is better when it is also good business.", maxlength: 2000 },
    footerTitle: { type: String, required: true, trim: true, default: "Stay in the loop.", maxlength: 120 },
    footerText: { type: String, required: true, trim: true, default: "New products, stories, and good things from Nech Work.", maxlength: 500 },
    contactEmail: { type: String, required: true, trim: true, lowercase: true, default: "aaron162103@gmail.com", maxlength: 254 },
    contactOffices: { type: String, required: true, trim: true, default: "Addis Ababa main office | +251948931000 | Lideta, Nech Work Building B01\nGondar branch office | +251918992121 | Gondar,Buna Tera Building B01\nMetema branch office | +251936111212 | Metema", maxlength: 2000 },
    telegramUsername: { type: String, required: true, trim: true, default: "Luv16210301", maxlength: 64 },
    shopVideoUrl: { type: String, trim: true, default: "", maxlength: 1500 },
    shopVideoTitle: { type: String, trim: true, default: "A taste of Ethiopia", maxlength: 150 },
    shopVideoCategory: { type: String, trim: true, default: "Coffee", maxlength: 100 },
  },
  { timestamps: true },
);

export default mongoose.model<ISiteContent>("SiteContent", SiteContentSchema);
