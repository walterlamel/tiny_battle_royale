import React, { useEffect, useState } from 'react';
import { StaticQuery, useStaticQuery, graphql, Link } from "gatsby"


import Layout from "../components/layout"
import Seo from "../components/seo"
import HeaderGame from "../components/HeaderGame"
import HeaderPresentation from "../components/header_presentation"

const About = () => {

    const [SeoText, setSeoText] = useState({})

    //récupération de toutes les images
    const data = useStaticQuery(
        graphql`
        query {
            allMarkdownRemark(filter: {frontmatter: {title: {eq: "about_text"}}}) {
              edges {
                node {
                  id
                  html
                  frontmatter {
                    title
                  }
                }
              }
            }
          }
        `
    )

    
    useEffect(() => {
        let seo_text = data.allMarkdownRemark?.edges[0]?.node
        setSeoText(seo_text)
    }, [])

    return (
        <Layout>
            <Seo title="About" />
            <HeaderPresentation>A propos de Tiny Battle Royale</HeaderPresentation>

            <div 
            className = "text_seo_about"
            dangerouslySetInnerHTML={{ __html: SeoText?.html }} 
            />

        </Layout>
    );
};

export default About;