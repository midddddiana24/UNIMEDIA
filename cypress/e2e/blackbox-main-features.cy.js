/// <reference types="cypress" />

describe('UniMedia Black Box E2E Tests - All Main Features', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.wait(2000); // Wait for app load
  });

  it('1. Health Check & Basic UI Load', () => {
    cy.request('/health').then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.status).to.eq('ok');
    });
    cy.get('body').should('be.visible');
  });

  it('2. API Key Verification Flow', () => {
    cy.window().then((win) => {
      // Simulate API key input
      cy.get('input[placeholder*="API"]').type('gsk_testkey');
      cy.contains('Verify').click();
      cy.wait(1000);
    });
  });

  it('3. Text-to-Speech Feature', () => {
    cy.get('textarea').type('Hello UniMedia');
    cy.contains('Speak').click();
    cy.wait(3000);
    // Verify audio plays or response
    cy.get('audio').should('exist');
  });

  it('4. AI Chat/Summarization', () => {
    cy.get('textarea').type('Summarize machine learning');
    cy.contains('Send').click();
    cy.wait(5000);
    cy.contains('source: groq').should('be.visible');
  });

  it('5. Document Upload & Processing', () => {
    cy.get('input[type="file"]').selectFile({ contents: 'Test document content', fileName: 'test.txt' });
    cy.contains('Process').click();
    cy.wait(5000);
    cy.contains('Document summary').should('be.visible');
  });

  it('6. Image OCR Feature', () => {
    // Simulate image upload
    cy.get('input[type="file"]').selectFile({ contents: Buffer.from('fake image data'), fileName: 'test.jpg' });
    cy.contains('OCR').click();
    cy.wait(3000);
  });

  it('7. End-to-End Workflow: Text → TTS → Summary', () => {
    cy.get('textarea').type('The water cycle is evaporation');
    cy.contains('Speak').click();
    cy.wait(2000);
    cy.get('textarea').type('Summarize this text about water cycle');
    cy.contains('Send').click();
    cy.wait(4000);
    cy.contains('text:').should('be.visible');
  });

  it('8. Error Handling - Invalid Inputs', () => {
    cy.get('textarea').clear();
    cy.contains('Send').click();
    cy.contains('Error').should('be.visible');
  });

  it('9. Concurrent Operations', () => {
    cy.get('textarea').type('Test 1');
    cy.contains('Send').click();
    cy.get('textarea').type('Test 2');
    cy.contains('Send').click();
    cy.wait(3000);
    cy.get('[data-cy=response]').should('have.length.gte', 1);
  });
});
