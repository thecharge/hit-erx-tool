package gov.nist.hit.erx.web.controller;


import gov.nist.hit.core.domain.*;
import gov.nist.hit.core.domain.util.XmlUtil;
import gov.nist.hit.core.repo.TransactionRepository;
import gov.nist.hit.core.repo.UserRepository;
import gov.nist.hit.core.service.TestStepService;
import gov.nist.hit.core.service.TransportConfigService;
import gov.nist.hit.core.service.exception.TestCaseException;
import gov.nist.hit.core.service.exception.UserNotFoundException;
import gov.nist.hit.core.transport.exception.TransportClientException;
import gov.nist.hit.erx.web.utils.Utils;
import gov.nist.hit.erx.ws.client.WebServiceClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;


/**
 * Created by mcl1 on 12/16/15.
 */

@RestController
@Controller
@RequestMapping("/transport/erx/rest")
public class RestTransportController {

    static final Logger logger = LoggerFactory.getLogger(RestTransportController.class);

    @Autowired
    protected TestStepService testStepService;

    @Autowired
    protected UserRepository userRepository;

    @Autowired
    protected TransactionRepository transactionRepository;

    @Autowired
    protected TransportConfigService transportConfigService;

    @Autowired
    @Qualifier("WebServiceClient")
    protected WebServiceClient webServiceClient;

    private final static String DOMAIN = "erx";
    private final static String PROTOCOL = "rest";

    @Transactional()
    @RequestMapping(value = "/user/{userId}/taInitiator", method = RequestMethod.POST)
    public Map<String, String> taInitiatorConfig(@PathVariable("userId") final Long userId)
            throws UserNotFoundException {
        logger.info("Fetching user ta initiator information ... ");
        User user = null;
        TransportConfig transportConfig = null;
        if (userId == null || (user = userRepository.findOne(userId)) == null) {
            throw new UserNotFoundException();
        }
        transportConfig = transportConfigService.findOneByUserAndProtocol(user.getId(), PROTOCOL);
        if (transportConfig == null) {
            transportConfig = transportConfigService.create(PROTOCOL);
            user.addConfig(transportConfig);
            userRepository.save(user);
            transportConfigService.save(transportConfig);
        }
        Map<String, String> config = transportConfig.getTaInitiator();
        return config;
    }

    @Transactional()
    @RequestMapping(value = "/user/{userId}/sutInitiator", method = RequestMethod.POST)
    public Map<String, String> sutInitiatorConfig(@PathVariable("userId") final Long userId,
                                                  HttpServletRequest request) throws UserNotFoundException {
        logger.info("Fetching user information ... ");
        User user = null;
        TransportConfig transportConfig = null;
        if (userId == null || (user = userRepository.findOne(userId)) == null) {
            throw new UserNotFoundException();
        }
        transportConfig = transportConfigService.findOneByUserAndProtocol(user.getId(), PROTOCOL);
        if (transportConfig == null) {
            transportConfig = transportConfigService.create(PROTOCOL);
            user.addConfig(transportConfig);
            userRepository.save(user);
        }
        Map<String, String> config = transportConfig.getSutInitiator();
        if (config == null) {
            config = new HashMap<String, String>();
            transportConfig.setSutInitiator(config);
        }

        if (config.get("password") == null && config.get("username") == null) {
            config.put("username", "vendor_" + user.getId());
            config.put("password", "vendor_" + user.getId());
        }

        if (config.get("endpoint") == null) {
            config.put("endpoint", Utils.getUrl(request) + "/message");
        }
        transportConfigService.save(transportConfig);
        return config;
    }

    @Transactional()
    @RequestMapping(value = "/startListener", method = RequestMethod.POST)
    public boolean open(@RequestBody SendRequest request)  throws UserNotFoundException {
        logger.info("Open transaction for user with id=" + request.getUserId()
                + " and of test step with id=" + request.getTestStepId());
        Transaction transaction = searchTransaction(request);
        if (transaction == null) {
            transaction = new Transaction();
            transaction.setTestStep(testStepService.findOne(request.getTestStepId()));
            transaction.setUser(userRepository.findOne(request.getUserId()));
            transaction.setConfig(request.getConfig());
            transaction.setResponseMessageId(request.getResponseMessageId());
            transactionRepository.save(transaction);
        }
        transaction.init();;
        transactionRepository.saveAndFlush(transaction);
        return false;
    }

    @Transactional()
    @RequestMapping(value = "/stopListener", method = RequestMethod.POST)
    public boolean close(@RequestBody SendRequest request)  throws UserNotFoundException {
        logger.info("Closing transaction for user with id=" + request.getUserId()
                + " and of test step with id=" + request.getTestStepId());
        Transaction transaction = searchTransaction(request);
        if (transaction != null) {
            transaction.close();
            transactionRepository.saveAndFlush(transaction);
        }
        return true;
    }

    @RequestMapping(value = "/searchTransaction", method = RequestMethod.POST)
    public Transaction searchTransaction(@RequestBody SendRequest request) {
        logger.info("Get transaction of user with id=" + request.getUserId()
                + " and of testStep with id=" + request.getTestStepId());
        List<KeyValuePair> criteria = new ArrayList<KeyValuePair>();
        criteria.add(new KeyValuePair("username", request.getConfig().get("username")));
        criteria.add(new KeyValuePair("password", request.getConfig().get("password")));
        Transaction transaction = transactionRepository.findOneByCriteria(criteria);
        return transaction;
    }

    @Transactional()
    @RequestMapping(value = "/send", method = RequestMethod.POST)
    public Transaction send(@RequestBody SendRequest request) throws TransportClientException {
        logger.info("Sending message  with user id=" + request.getUserId() + " and test step with id="
                + request.getTestStepId());
        try {
            Long testStepId = request.getTestStepId();
            Long userId = request.getUserId();
            TransportConfig config =
                    transportConfigService.findOneByUserAndProtocolAndDomain(userId, PROTOCOL, DOMAIN);
            config.setTaInitiator(request.getConfig());
            transportConfigService.save(config);
            TestStep testStep = testStepService.findOne(testStepId);
            if (testStep == null)
                throw new TestCaseException("Unknown test step with id=" + testStepId);
            String outgoingMessage = request.getMessage();
            String incomingMessage =
                    webServiceClient.send(outgoingMessage, request.getConfig().get("username"),request.getConfig().get("password"),request.getConfig().get("endpoint"));
            String tmp = incomingMessage;
            try {
                incomingMessage = XmlUtil.prettyPrint(incomingMessage);
            } catch (Exception e) {
                incomingMessage = tmp;
            }
            Transaction transaction = transactionRepository.findOneByUserAndTestStep(userId, testStepId);
            if (transaction == null) {
                transaction = new Transaction();
                transaction.setTestStep(testStepService.findOne(testStepId));
                transaction.setUser(userRepository.findOne(userId));
                transaction.setOutgoing(outgoingMessage);
                transaction.setIncoming(incomingMessage);
                transactionRepository.save(transaction);
            }
            return transaction;
        } catch (Exception e1) {
            throw new TransportClientException("Failed to send the message." + e1.getMessage());
        }
    }

    @Transactional()
    @RequestMapping(value = "/message", method = RequestMethod.POST)
    public String message(@RequestBody SendRequest request) throws TransportClientException {
        //TODO check auth
        logger.debug("Send message request received : "+request.toString());
        return this.webServiceClient.send(request.getMessage(),"username","password",request.getConfig().get("endpoint"));
    }

    @Transactional()
    @RequestMapping(value = "/test", method = RequestMethod.GET)
    public String test(@RequestParam String username){
        //TODO check auth
        String password = "pass";
        return "hello "+username;
    }

    public TransactionRepository getTransactionRepository() {
        return transactionRepository;
    }

    public void setTransactionRepository(TransactionRepository transactionRepository) {
        this.transactionRepository = transactionRepository;
    }


}
