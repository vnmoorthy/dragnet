import neo4j, { Driver, Session } from 'neo4j-driver';

let driver: Driver | null = null;

export function getDriver(): Driver {
  if (!driver) {
    const { NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD } = process.env;
    if (!NEO4J_URI) throw new Error('NEO4J_URI not set');
    driver = neo4j.driver(
      NEO4J_URI,
      neo4j.auth.basic(NEO4J_USER || 'neo4j', NEO4J_PASSWORD || ''),
    );
  }
  return driver;
}

export function getSession(): Session {
  return getDriver().session();
}

export async function closeDriver() {
  if (driver) { await driver.close(); driver = null; }
}

export const hasNeo4j = () => Boolean(process.env.NEO4J_URI);
