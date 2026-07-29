// controllers/messageController.js
import Message from "../models/Message.js";
import Notification from "../models/Notification.js";
import { resolveRecipients } from "../utils/resolveRecipients.js";
import { bulkSend } from "../utils/bulkSend.js";
import { logAction } from "../models/AuditLog.js";

// POST /api/messages/send
// body: { title, body, channels: ["sms","email","in-app"], filter: {...} }
export const sendMessage = async (req, res) => {
  try {
    const { title, body, channels, filter } = req.body;
    if (!body || !channels?.length || !filter?.audience) {
      return res.status(400).json({ message: "Message body, at least one channel, and an audience filter are required" });
    }

    const recipients = await resolveRecipients(filter);
    if (!recipients.length) {
      return res.status(400).json({ message: "No recipients matched this filter" });
    }

    const deliveryResults = { sms: { attempted: 0, sent: 0, failed: 0 }, whatsapp: { attempted: 0, sent: 0, failed: 0 }, email: { attempted: 0, sent: 0, failed: 0 } };

    if (channels.some((c) => ["sms", "whatsapp", "email"].includes(c))) {
      const result = await bulkSend({ recipients, channels, title, body });
      Object.assign(deliveryResults, result);
    }

    if (channels.includes("in-app")) {
      const inAppRecipients = recipients.filter((r) => r.userId);
      await Notification.insertMany(
        inAppRecipients.map((r) => ({
          recipient: r.userId,
          title: title || "School Notice",
          body,
          category: filter.category || "general",
        }))
      );
    }

    const message = await Message.create({
      sender: req.user._id,
      title,
      body,
      channels,
      filterCriteria: filter,
      recipientCount: recipients.length,
      deliveryResults,
    });

    await logAction({ actor: req.user, action: "MESSAGE_SENT", targetType: "Message", targetId: message._id, details: { recipientCount: recipients.length, channels }, req });

    res.status(201).json({ message: "Message dispatched", recipientCount: recipients.length, deliveryResults });
  } catch (err) {
    res.status(500).json({ message: "Failed to send message", error: err.message });
  }
};

// GET /api/messages/history
export const getMessageHistory = async (req, res) => {
  const messages = await Message.find().populate("sender", "fullName").sort({ createdAt: -1 }).limit(100);
  res.json({ messages });
};

// GET /api/messages/notifications — the logged-in user's own in-app notifications
export const getMyNotifications = async (req, res) => {
  const notifications = await Notification.find({ recipient: req.user._id }).sort({ createdAt: -1 }).limit(50);
  const unreadCount = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
  res.json({ notifications, unreadCount });
};

// PATCH /api/messages/notifications/:id/read
export const markNotificationRead = async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { isRead: true },
    { new: true }
  );
  if (!notification) return res.status(404).json({ message: "Notification not found" });
  res.json({ notification });
};

// PATCH /api/messages/notifications/read-all
export const markAllNotificationsRead = async (req, res) => {
  await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true });
  res.json({ message: "All notifications marked as read" });
};
