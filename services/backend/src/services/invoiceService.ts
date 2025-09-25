// src/services/invoiceService.ts
import db from '../db';
import { Invoice } from '../types/invoice';
import axios from 'axios';
import { promises as fs } from 'fs';
import * as path from 'path';

interface InvoiceRow {
  id: string;
  userId: string;
  amount: number;
  dueDate: Date;
  status: string;
}

// Directorio auxiliar para los recibos
const INVOICE_UPLOADS_DIR = path.resolve("uploads/invoices");

// Funcion auxiliar para tener un directorio seguro para los recibos
function getSafePath(fileName: string): string {
  const resolvedPath = path.resolve(INVOICE_UPLOADS_DIR, fileName); //Se aplica la función auxiliar para garantizar seguridad.
  if (!resolvedPath.startsWith(INVOICE_UPLOADS_DIR)) {
    throw new Error("Invalid file path"); //Si el path absoluto no comienza con el directorio seguro entonces se lanza un error y no se continua
  }
  return resolvedPath;
}

class InvoiceService {
  static async list( userId: string, status?: string, operator?: string): Promise<Invoice[]> {
    let q = db<InvoiceRow>('invoices').where({ userId: userId });
    //if (status) q = q.andWhereRaw(" status "+ operator + " '"+ status +"'"); Vulnerabilidad identificada para mitigar
    const allowedOperators = ['=', '!=', '>', '<', '>=', '<=']; // Operadores permitidos para ingreso del usuario, esta vez controlados
    if (status && allowedOperators.includes(operator)){ //Se controla lo que se ingresa a "status" y "operator", si se encuentran en los operadores habilitados se ejecuta la consulta
      q = q.andWhereRaw("status " + operator + " ?", [status]); //Se sustituye status por "?" que es un marcador poisicional, y se utiliza un array para almacenar el valor a sustituir en el marcador posicional.
    } else {
      console.error("Operador no válido"); // Si el usuario intenta ingresar un valor prohibido se le prohibira continuar y no se ejecutara la consulta.
    }
    const rows = await q.select();
    const invoices = rows.map(row => ({
      id: row.id,
      userId: row.userId,
      amount: row.amount,
      dueDate: row.dueDate,
      status: row.status} as Invoice
    ));
    return invoices;
  }

  static async setPaymentCard(
    userId: string,
    invoiceId: string,
    paymentBrand: string,
    ccNumber: string,
    ccv: string,
    expirationDate: string
  ) {

     //Lista con los proveedores de pago permitidos
    const allowedPaymentProviders = ['visa', 'mastercard', 'american-express', 'paypal'];
    
    if (!allowedPaymentProviders.includes(paymentBrand.toLowerCase())) {
      throw new Error('Invalid payment provider. Allowed providers: ' + allowedPaymentProviders.join(', '));
    }
    // use axios to call http://paymentBrand/payments as a POST request
    // with the body containing ccNumber, ccv, expirationDate
    // and handle the response accordingly
    const paymentResponse = await axios.post(`http://${paymentBrand}/payments`, {
      ccNumber,
      ccv,
      expirationDate
    });
    if (paymentResponse.status !== 200) {
      throw new Error('Payment failed');
    }

    // Update the invoice status in the database
    await db('invoices')
      .where({ id: invoiceId, userId })
      .update({ status: 'paid' });  
    };
  static async  getInvoice( invoiceId:string): Promise<Invoice> {
    const invoice = await db<InvoiceRow>('invoices').where({ id: invoiceId }).first();
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    return invoice as Invoice;
  }


  static async getReceipt(
    invoiceId: string,
    pdfName: string
  ) {
    // check if the invoice exists
    const invoice = await db<InvoiceRow>('invoices').where({ id: invoiceId }).first();
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    try {
      /*const filePath = `/invoices/${pdfName}`;
      const content = await fs.readFile(filePath, 'utf-8');
      return content;*/
      const filePath = getSafePath(pdfName) //Ya no se pasa pdfName directamente, sino que se pasa por la función aux que valida el path
      const content = await fs.readFile(filePath, 'utf-8'); //Cuando se lea con fs.readFile siempre se va a leer el path ya verificado y seguro
      return content;
    } catch (error) {
      // send the error to the standard output
      console.error('Error reading receipt file:', error);
      throw new Error('Receipt not found');

    } 

  };

};

export default InvoiceService;
