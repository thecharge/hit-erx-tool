package gov.nist.hit.erx.ws.client.utils;

import javax.xml.transform.OutputKeys;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerException;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.stream.StreamResult;
import javax.xml.transform.stream.StreamSource;
import java.io.StringReader;
import java.io.StringWriter;

/**
 * This software was developed at the National Institute of Standards and Technology by employees of
 * the Federal Government in the course of their official duties. Pursuant to title 17 Section 105
 * of the United States Code this software is not subject to copyright protection and is in the
 * public domain. This is an experimental system. NIST assumes no responsibility whatsoever for its
 * use by other parties, and makes no guarantees, expressed or implied, about its quality,
 * reliability, or any other characteristic. We would appreciate acknowledgement if the software is
 * used. This software can be redistributed and/or modified freely provided that any derivative
 * works bear some notice that they are derived from it, and any modified versions bear some notice
 * that they have been modified.
 * <p/>
 * Created by Maxence Lefort on 4/7/16.
 */
public class MessageUtils {

    public static String prettyPrint(String message){
        if (message.startsWith("UNA") && message.length() >= 9) {
            message = message.replace("\n","");
            //UNA:+./*'
            String lineSeparator = message.substring(8, 9);
            message = message.replace(lineSeparator, lineSeparator + "\n").substring(0,message.length()-"\n".length());
        } else {
            try {
                Transformer transformer = TransformerFactory.newInstance().newTransformer();
                transformer.setOutputProperty(OutputKeys.INDENT, "yes");
//initialize StreamResult with File object to save to file
                StreamResult result = new StreamResult(new StringWriter());
                StreamSource source = new StreamSource(new StringReader(message));
                transformer.transform(source, result);
                String prettyXmlString = result.getWriter().toString();
                if (prettyXmlString != null && prettyXmlString != "") {
                    message = prettyXmlString;
                }
            } catch (TransformerException e) {
                e.printStackTrace();
            }
        }
        return message;
    }
}
