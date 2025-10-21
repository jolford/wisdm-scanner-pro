import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';

interface MaintenanceInvoiceGeneratorProps {
  license: {
    id: string;
    license_key: string;
    total_documents: number;
    remaining_documents: number;
    end_date: string;
    customers: {
      company_name: string;
      contact_email: string;
      contact_name: string;
      phone?: string;
    };
  };
}

export const MaintenanceInvoiceGenerator = ({ license }: MaintenanceInvoiceGeneratorProps) => {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  
  // Invoice form state
  const [invoiceData, setInvoiceData] = useState({
    invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
    date: new Date().toLocaleDateString('en-US'),
    dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US'),
    terms: 'Net 45',
    poNumber: '',
    billToAddress: '',
    shipToAddress: '',
    lineItems: [
      {
        description: `License Volume Renewal - ${license.customers?.company_name}`,
        qty: 1,
        unitPrice: 0,
        amount: 0
      }
    ],
    notes: 'Your current license volume is running low. Please renew to continue service.',
  });

  const calculateSubtotal = () => {
    return invoiceData.lineItems.reduce((sum, item) => sum + item.amount, 0);
  };

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Company Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Western Integrated Systems', 20, 20);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('3657 Grand Avenue', 20, 28);
      doc.text('Oakland, CA 94610 US', 20, 33);
      doc.text('(866) 736-2191', 20, 38);
      doc.text('www.westint.com', 20, 43);
      
      // Invoice Title
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('INVOICE', pageWidth - 20, 30, { align: 'right' });
      
      // Invoice Info Box
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('INVOICE #', pageWidth - 80, 50);
      doc.text('DATE', pageWidth - 80, 55);
      doc.text('DUE DATE', pageWidth - 80, 60);
      doc.text('TERMS', pageWidth - 80, 65);
      
      doc.setFont('helvetica', 'normal');
      doc.text(invoiceData.invoiceNumber, pageWidth - 40, 50);
      doc.text(invoiceData.date, pageWidth - 40, 55);
      doc.text(invoiceData.dueDate, pageWidth - 40, 60);
      doc.text(invoiceData.terms, pageWidth - 40, 65);
      
      // Bill To Section
      doc.setFont('helvetica', 'bold');
      doc.text('BILL TO', 20, 60);
      doc.setFont('helvetica', 'normal');
      doc.text(license.customers?.company_name || '', 20, 67);
      if (invoiceData.billToAddress) {
        const billToLines = doc.splitTextToSize(invoiceData.billToAddress, 70);
        doc.text(billToLines, 20, 72);
      }
      
      // PO Number if provided
      if (invoiceData.poNumber) {
        doc.setFont('helvetica', 'bold');
        doc.text('PO NUMBER', 20, 95);
        doc.setFont('helvetica', 'normal');
        doc.text(invoiceData.poNumber, 20, 100);
      }
      
      // Line Items Table
      let yPos = 120;
      doc.setFont('helvetica', 'bold');
      doc.text('DESCRIPTION', 20, yPos);
      doc.text('QTY', 120, yPos, { align: 'right' });
      doc.text('UNIT PRICE', 145, yPos, { align: 'right' });
      doc.text('AMOUNT', pageWidth - 20, yPos, { align: 'right' });
      
      // Draw header line
      doc.line(20, yPos + 2, pageWidth - 20, yPos + 2);
      yPos += 8;
      
      // Line items
      doc.setFont('helvetica', 'normal');
      invoiceData.lineItems.forEach((item) => {
        const descLines = doc.splitTextToSize(item.description, 90);
        doc.text(descLines, 20, yPos);
        doc.text(item.qty.toString(), 120, yPos, { align: 'right' });
        doc.text(`$${item.unitPrice.toFixed(2)}`, 145, yPos, { align: 'right' });
        doc.text(`$${item.amount.toFixed(2)}`, pageWidth - 20, yPos, { align: 'right' });
        yPos += descLines.length * 5 + 3;
      });
      
      // Totals Section
      yPos += 12;
      const subtotal = calculateSubtotal();
      const tax = 0;
      const total = subtotal + tax;
      
      const labelX = pageWidth - 90;
      const amountX = pageWidth - 20;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('SUBTOTAL', labelX, yPos, { align: 'right' });
      doc.text(`$${subtotal.toFixed(2)}`, amountX, yPos, { align: 'right' });
      
      yPos += 8;
      doc.text('TAX', labelX, yPos, { align: 'right' });
      doc.text(`$${tax.toFixed(2)}`, amountX, yPos, { align: 'right' });
      
      yPos += 8;
      doc.setFontSize(11);
      doc.text('TOTAL', labelX, yPos, { align: 'right' });
      doc.text(`$${total.toFixed(2)}`, amountX, yPos, { align: 'right' });
      
      yPos += 12;
      doc.setFontSize(12);
      doc.text('BALANCE DUE', labelX, yPos, { align: 'right' });
      doc.text(`$${total.toFixed(2)}`, amountX, yPos, { align: 'right' });
      
      // Notes section
      if (invoiceData.notes) {
        yPos += 15;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        const noteLines = doc.splitTextToSize(invoiceData.notes, pageWidth - 40);
        doc.text(noteLines, 20, yPos);
      }
      
      // Payment Methods Footer
      yPos = doc.internal.pageSize.getHeight() - 60;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Preferred Payment Methods:', 20, yPos);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      yPos += 6;
      doc.text('1. ACH - City National Bank | Routing: 122016066 | Account: 432008649', 20, yPos);
      yPos += 5;
      doc.text('2. Check - Western Integrated Systems, 1504 Eureka Road, Suite 230, Roseville, CA 95661', 20, yPos);
      yPos += 5;
      doc.text('3. Credit Card - 3% Surcharge Added', 20, yPos);
      
      // Certifications
      yPos += 10;
      doc.setFontSize(8);
      doc.text('CA MB/DVBE: 15814 | CMAS: 3-19-70-2586D | D&B: 623333598 | FEIN: 94-2786660', 20, yPos);
      
      // Save the PDF
      const fileName = `Maintenance_Invoice_${license.customers?.company_name.replace(/\s+/g, '_')}_${invoiceData.invoiceNumber}.pdf`;
      doc.save(fileName);
      
      toast({
        title: "Invoice Generated",
        description: `${fileName} has been downloaded successfully.`,
      });
    } catch (error) {
      console.error('Error generating invoice:', error);
      toast({
        title: "Error",
        description: "Failed to generate invoice. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    const newLineItems = [...invoiceData.lineItems];
    newLineItems[index] = { ...newLineItems[index], [field]: value };
    
    // Auto-calculate amount if qty or unitPrice changes
    if (field === 'qty' || field === 'unitPrice') {
      newLineItems[index].amount = newLineItems[index].qty * newLineItems[index].unitPrice;
    }
    
    setInvoiceData({ ...invoiceData, lineItems: newLineItems });
  };

  const addLineItem = () => {
    setInvoiceData({
      ...invoiceData,
      lineItems: [
        ...invoiceData.lineItems,
        { description: '', qty: 1, unitPrice: 0, amount: 0 }
      ]
    });
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <FileText className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Generate Maintenance Invoice</h3>
      </div>

      <div className="space-y-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Invoice Number</Label>
            <Input
              value={invoiceData.invoiceNumber}
              onChange={(e) => setInvoiceData({ ...invoiceData, invoiceNumber: e.target.value })}
            />
          </div>
          <div>
            <Label>PO Number (Optional)</Label>
            <Input
              value={invoiceData.poNumber}
              onChange={(e) => setInvoiceData({ ...invoiceData, poNumber: e.target.value })}
              placeholder="Customer PO Number"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Date</Label>
            <Input
              value={invoiceData.date}
              onChange={(e) => setInvoiceData({ ...invoiceData, date: e.target.value })}
            />
          </div>
          <div>
            <Label>Due Date</Label>
            <Input
              value={invoiceData.dueDate}
              onChange={(e) => setInvoiceData({ ...invoiceData, dueDate: e.target.value })}
            />
          </div>
          <div>
            <Label>Terms</Label>
            <Input
              value={invoiceData.terms}
              onChange={(e) => setInvoiceData({ ...invoiceData, terms: e.target.value })}
            />
          </div>
        </div>

        <div>
          <Label>Bill To Address</Label>
          <Textarea
            value={invoiceData.billToAddress}
            onChange={(e) => setInvoiceData({ ...invoiceData, billToAddress: e.target.value })}
            placeholder="Customer billing address"
            rows={3}
          />
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-base">Line Items</Label>
            <Button size="sm" variant="outline" onClick={addLineItem}>
              Add Item
            </Button>
          </div>
          
          {invoiceData.lineItems.map((item, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 mb-2">
              <div className="col-span-6">
                <Input
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <Input
                  type="number"
                  placeholder="Qty"
                  value={item.qty}
                  onChange={(e) => updateLineItem(index, 'qty', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="col-span-2">
                <Input
                  type="number"
                  placeholder="Unit Price"
                  value={item.unitPrice}
                  onChange={(e) => updateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="col-span-2">
                <Input
                  type="number"
                  placeholder="Amount"
                  value={item.amount}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>
          ))}
        </div>

        <div>
          <Label>Notes</Label>
          <Textarea
            value={invoiceData.notes}
            onChange={(e) => setInvoiceData({ ...invoiceData, notes: e.target.value })}
            rows={2}
          />
        </div>

        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="font-semibold">Total Amount:</span>
            <span className="text-2xl font-bold">${calculateSubtotal().toFixed(2)}</span>
          </div>
        </div>
      </div>

      <Button 
        onClick={generatePDF} 
        disabled={generating}
        className="w-full"
      >
        <Download className="h-4 w-4 mr-2" />
        {generating ? 'Generating...' : 'Generate & Download Invoice'}
      </Button>
    </Card>
  );
};
