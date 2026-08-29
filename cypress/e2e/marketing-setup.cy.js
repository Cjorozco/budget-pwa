// cypress/e2e/marketing-setup.cy.js
//
// Correr SOLO contra localhost. baseUrl: http://localhost:5173
// npm run dev (terminal 1) → npm run cypress:record (terminal 2)
// `cypress:open` sirve para depurar; NO genera MP4.
// El MP4 queda FUERA del repo: C:\Users\JoseO\Videos\personal-buget-pwa\
// `cypress/videos/` del proyecto no se usa (OneDrive). `cypress open` no graba.
//
// Cypress usa SU propio navegador (IndexedDB distinto al Chrome normal).
// Además, con testIsolation cada `it` arranca en about:blank: el seed del
// `before()` no sirve para las escenas 1b–4. Sembramos en beforeEach.

function loadDemoSeed(path = '/') {
  cy.visit(path);
  // El hook se asigna con import() dinámico DESPUÉS del load; hay que esperarlo.
  // .should(callback) reintenta y sigue entregando el window (no la propiedad).
  cy.window({ timeout: 15000 })
    .should((win) => {
      expect(win.__seedBudgetDemo, '__seedBudgetDemo').to.be.a('function');
    })
    .then((win) => win.__seedBudgetDemo());
}

describe('Budget-PWA - Video de marketing', { testIsolation: false }, () => {
  // testIsolation:false = IndexedDB sobrevive entre `it`.
  // El seed es la misma función que el botón violeta, sin confirm/alert/reload
  // (eso rompía las escenas 1b–4: Cypress resetea la página entre tests).
  before(() => {
    loadDemoSeed();
  });

  // ESCENA 1 (5-12s): Resumen con reserva activa
  it('Escena 1 - Resumen: disponible vs en bancos', () => {
    cy.visit('/');
    cy.contains('Total disponible', { timeout: 10000 }).should('be.visible');
    cy.contains('En Bancos').should('be.visible');
    // Esto SÍ prueba que el seed corrió (sin reserva este copy no existe)
    cy.contains('has apartado', { timeout: 10000 }).should('be.visible');
    cy.wait(3000);
  });

  // ESCENA 1b: detalle de la reserva (modal; la card no es clickeable)
  it('Escena 1b - Modal de reserva Factura de servicios', () => {
    cy.visit('/accounts');
    cy.get('[data-testid="account-card"][data-account-name="Bancolombia"]', { timeout: 10000 })
      .find('[data-testid="view-reserves-button"]')
      .should('be.visible')
      .click();
    cy.contains('Factura de servicios', { timeout: 10000 }).should('be.visible');
    cy.wait(2000);
  });

  // ESCENA 2: Categorizador en vivo
  it('Escena 2 - Categorizador en vivo: Uber al jardín', () => {
    // Re-sembrar aquí: un Retry de solo este `it` no corre el `before()`,
    // y si Sofia › Transporte ya existía el panel nunca aparece.
    loadDemoSeed('/transactions');

    cy.get('[data-testid="new-transaction-button"]').click();
    cy.get('[role="dialog"]').should('be.visible');

    cy.get('[data-testid="amount-input"]').should('be.visible').type('18000');
    cy.get('[data-testid="description-input"]')
      .should('be.visible')
      .clear()
      .type('Uber al jardín', { delay: 40 })
      .should('have.value', 'Uber al jardín');

    // Sofia › Transporte no está en el seed: sale la cajita "Crear y aplicar",
    // no se llena el <select> solo. Eso es la escena de marketing.
    // Debounce 500ms + IndexedDB; si la categoría ya existiera el panel no sale.
    cy.get('[data-testid="category-suggestion-panel"]', { timeout: 15000 }).should('be.visible');
    cy.contains('Crear y aplicar').should('be.visible');
    cy.get('[data-testid="apply-category-button"]').click();

    cy.get('[data-testid="category-select"]', { timeout: 8000 })
      .should('not.have.value', '');

    cy.wait(2000);
  });

  // ESCENA 3: Reconciliación
  it('Escena 3 - Reconciliar Bancolombia', () => {
    cy.visit('/accounts');
    cy.get('[data-testid="account-card"][data-account-name="Bancolombia"]', { timeout: 10000 })
      .find('[data-testid="reconcile-button"]')
      .click();

    cy.get('[role="dialog"]').should('be.visible');
    cy.get('[data-testid="declared-balance-input"]')
      .should(($input) => {
        expect(Number($input.val()), 'saldo calculado precargado').to.be.greaterThan(0);
      })
      .then(($input) => {
        const calculated = Number($input.val());
        cy.wrap($input).clear().type(String(calculated + 35000));
      });

    cy.get('[data-testid="reconciliation-diff"]').should('be.visible');
    cy.wait(2500);
  });

  // ESCENA 4: Informes
  it('Escena 4 - Gráfico de gastos por categoría', () => {
    cy.visit('/reports');
    cy.contains('Gastos por Categoría', { timeout: 10000 }).should('be.visible');
    cy.get('[data-testid="expense-chart"] .recharts-rectangle', { timeout: 10000 })
      .should('have.length.greaterThan', 1);
    cy.wait(3000);
  });
});
