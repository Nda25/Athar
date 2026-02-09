import { Layout } from "@modules/layout";
import { Hero } from "../ui/Hero";
import { Programs } from "../ui/Programs";
import { Quotes } from "../ui/Quotes";
import { Services } from "../ui/Services";
import { SEO } from "@shared/seo/SEO";

export default function Home() {
  return (
    <Layout>
      <SEO page="home" />
      <Hero />
      <Services />
      <Quotes />
      <Programs />
    </Layout>
  );
}
